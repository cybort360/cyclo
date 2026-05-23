import {
  type PublicClient,
  type WalletClient,
  parseEventLogs,
} from 'viem'
import { SUBSCRIPTION_MANAGER_ABI, SUBSCRIPTION_NFT_ABI, USDC_ABI } from './abi.js'
import { toUsdcUnits, fromUsdcUnits, daysToSeconds, secondsToDays } from './utils.js'
import type {
  CycloClientConfig,
  Plan,
  Subscription,
  CreatePlanParams,
  CycloEventName,
  CycloEventCallback,
} from './types.js'

/** Canonical zero address used as sentinel for "NFT not configured". */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export class CycloClient {
  private contractAddress: `0x${string}`
  private usdcAddress: `0x${string}`
  private publicClient: PublicClient
  private walletClient: WalletClient | undefined
  private listeners: Map<CycloEventName, CycloEventCallback[]> = new Map()
  private unwatchers: (() => void)[] = []
  /**
   * Cached NFT contract address. Set from config on construction when provided,
   * otherwise populated on first RPC fetch. Only non-zero addresses are cached —
   * a zero return means the NFT is not yet configured and is re-read each call
   * in case setSubscriptionNFT() is called between client initialisation and use.
   */
  private _resolvedNftAddress: `0x${string}` | undefined

  constructor(config: CycloClientConfig) {
    this.contractAddress = config.contractAddress
    this.usdcAddress = config.usdcAddress
    this.publicClient = config.publicClient
    this.walletClient = config.walletClient
    if (config.subscriptionNFTAddress) {
      this._resolvedNftAddress = config.subscriptionNFTAddress
    }
  }

  setWalletClient(walletClient: WalletClient) {
    this.walletClient = walletClient
  }

  // ─── Plans ────────────────────────────────────────────────────────────────

  async getPlan(planId: bigint): Promise<Plan> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: 'getPlan',
      args: [planId],
    }) as { merchant: `0x${string}`; price: bigint; interval: bigint; trialDuration: number; active: boolean }

    return {
      id: planId,
      merchant: result.merchant,
      price: result.price,
      priceUsdc: fromUsdcUnits(result.price),
      interval: result.interval,
      intervalDays: secondsToDays(result.interval),
      trialDuration: BigInt(result.trialDuration),
      trialDays: result.trialDuration / 86400,
      active: result.active,
    }
  }

  async createPlan(params: CreatePlanParams): Promise<bigint> {
    const wallet = this.requireWallet()
    const [account] = await wallet.getAddresses()

    const price = toUsdcUnits(params.price)
    const interval = daysToSeconds(params.intervalDays)
    const trial = daysToSeconds(params.trialDays ?? 0)

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: 'createPlan',
      args: [price, interval, Number(trial)],
      account,
      chain: wallet.chain,
    })

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    const logs = parseEventLogs({
      abi: SUBSCRIPTION_MANAGER_ABI,
      logs: receipt.logs,
      eventName: 'PlanCreated',
    })

    if (logs.length === 0) throw new Error('PlanCreated event not found in receipt')
    return (logs[0].args as { planId: bigint }).planId
  }

  async deactivatePlan(planId: bigint): Promise<void> {
    const wallet = this.requireWallet()
    const [account] = await wallet.getAddresses()

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: 'deactivatePlan',
      args: [planId],
      account,
      chain: wallet.chain,
    })

    await this.publicClient.waitForTransactionReceipt({ hash })
  }

  getSubscribeLink(planId: bigint, baseUrl: string): string {
    const base = baseUrl.replace(/\/$/, '')
    return `${base}/subscribe/${planId.toString()}`
  }

  // ─── Subscriptions ────────────────────────────────────────────────────────

  async getSubscription(subscriber: `0x${string}`, planId: bigint): Promise<Subscription> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: 'getSubscription',
      args: [planId, subscriber],
    }) as { nextChargeTimestamp: number; active: boolean }

    return {
      planId,
      subscriber,
      nextChargeTimestamp: BigInt(result.nextChargeTimestamp),
      active: result.active,
    }
  }

  async subscribe(planId: bigint): Promise<void> {
    const wallet = this.requireWallet()
    const [account] = await wallet.getAddresses()

    await this.ensureAllowance(account, planId)

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: 'subscribe',
      args: [planId],
      account,
      chain: wallet.chain,
    })

    await this.publicClient.waitForTransactionReceipt({ hash })
  }

  async cancelSubscription(planId: bigint): Promise<void> {
    const wallet = this.requireWallet()
    const [account] = await wallet.getAddresses()

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: 'cancelSubscription',
      args: [planId],
      account,
      chain: wallet.chain,
    })

    await this.publicClient.waitForTransactionReceipt({ hash })
  }

  async migratePlan(currentPlanId: bigint, newPlanId: bigint): Promise<void> {
    const wallet = this.requireWallet()
    const [account] = await wallet.getAddresses()

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: 'migratePlan',
      args: [currentPlanId, newPlanId],
      account,
      chain: wallet.chain,
    })

    await this.publicClient.waitForTransactionReceipt({ hash })
  }

  // ─── NFT ─────────────────────────────────────────────────────────────────

  /**
   * Returns true if `subscriber` holds an active soulbound NFT for `planId`.
   *
   * If the SubscriptionNFT contract is not yet configured on the SubscriptionManager
   * (i.e. subscriptionNFT() returns the zero address), this returns false without
   * making a second RPC call. The NFT address is cached after the first successful
   * read so subsequent calls are a single RPC round-trip.
   */
  async isSubscribed(subscriber: `0x${string}`, planId: bigint): Promise<boolean> {
    const nftAddress = await this.resolveNftAddress()
    if (nftAddress === ZERO_ADDRESS) return false
    return await this.publicClient.readContract({
      address: nftAddress,
      abi: SUBSCRIPTION_NFT_ABI,
      functionName: 'isSubscribed',
      args: [subscriber, planId],
    }) as boolean
  }

  /**
   * Returns the tokenId of the soulbound NFT held by `subscriber` for `planId`,
   * or null if the subscriber does not hold a token (not subscribed, or NFT not configured).
   */
  async getSubscriberTokenId(subscriber: `0x${string}`, planId: bigint): Promise<bigint | null> {
    const nftAddress = await this.resolveNftAddress()
    if (nftAddress === ZERO_ADDRESS) return null

    const subscribed = await this.publicClient.readContract({
      address: nftAddress,
      abi: SUBSCRIPTION_NFT_ABI,
      functionName: 'isSubscribed',
      args: [subscriber, planId],
    }) as boolean
    if (!subscribed) return null

    return await this.publicClient.readContract({
      address: nftAddress,
      abi: SUBSCRIPTION_NFT_ABI,
      functionName: 'tokenOfSubscriber',
      args: [subscriber, planId],
    }) as bigint
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  on<T = unknown>(event: CycloEventName, callback: CycloEventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
      this.watchEvent(event)
    }
    this.listeners.get(event)!.push(callback as CycloEventCallback)

    return () => {
      const list = this.listeners.get(event) ?? []
      const idx = list.indexOf(callback as CycloEventCallback)
      if (idx !== -1) list.splice(idx, 1)
    }
  }

  destroy() {
    this.unwatchers.forEach(u => u())
    this.unwatchers = []
    this.listeners.clear()
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private requireWallet(): WalletClient {
    if (!this.walletClient) throw new Error('walletClient required for write operations')
    return this.walletClient
  }

  /**
   * Resolves the SubscriptionNFT contract address.
   * Uses the config-provided address when available. Otherwise reads from the
   * SubscriptionManager and caches any non-zero result for subsequent calls.
   */
  private async resolveNftAddress(): Promise<`0x${string}`> {
    if (this._resolvedNftAddress !== undefined) return this._resolvedNftAddress
    const addr = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: 'subscriptionNFT',
    }) as `0x${string}`
    // Cache only when configured; zero means "not yet set" and may change.
    if (addr !== ZERO_ADDRESS) {
      this._resolvedNftAddress = addr
    }
    return addr
  }

  private async ensureAllowance(account: `0x${string}`, planId: bigint): Promise<void> {
    // Read plan price so we can set a bounded allowance (12 months)
    const plan = await this.getPlan(planId)
    const required = plan.price * 12n

    const allowance = await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [account, this.contractAddress],
    }) as bigint

    // Only re-approve if remaining allowance covers fewer than 2 months
    if (allowance >= plan.price * 2n) return

    const wallet = this.requireWallet()
    const hash = await wallet.writeContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [this.contractAddress, required],
      account,
      chain: wallet.chain,
    })
    await this.publicClient.waitForTransactionReceipt({ hash })
  }

  private watchEvent(event: CycloEventName) {
    const unwatch = this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      eventName: event,
      onLogs: (logs) => {
        const callbacks = this.listeners.get(event) ?? []
        logs.forEach(log => callbacks.forEach(cb => cb(log.args)))
      },
    })
    this.unwatchers.push(unwatch)
  }
}
