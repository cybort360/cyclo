// src/client.ts
import {
  parseEventLogs
} from "viem";

// src/abi.ts
var SUBSCRIPTION_MANAGER_ABI = [
  { type: "constructor", inputs: [{ name: "usdcAddress", type: "address", internalType: "address" }, { name: "feeRecipient", type: "address", internalType: "address" }], stateMutability: "nonpayable" },
  { type: "function", name: "cancelSubscription", inputs: [{ name: "planId", type: "uint256", internalType: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "charge", inputs: [{ name: "planId", type: "uint256", internalType: "uint256" }, { name: "subscriber", type: "address", internalType: "address" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "createPlan", inputs: [{ name: "price", type: "uint256", internalType: "uint256" }, { name: "interval", type: "uint256", internalType: "uint256" }, { name: "trialDuration", type: "uint48", internalType: "uint48" }], outputs: [{ name: "planId", type: "uint256", internalType: "uint256" }], stateMutability: "nonpayable" },
  { type: "function", name: "deactivatePlan", inputs: [{ name: "planId", type: "uint256", internalType: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "batchCharge", inputs: [{ name: "planIds", type: "uint256[]", internalType: "uint256[]" }, { name: "subscribers", type: "address[]", internalType: "address[]" }], outputs: [{ name: "successCount", type: "uint256", internalType: "uint256" }], stateMutability: "nonpayable" },
  { type: "function", name: "pay", inputs: [{ name: "recipient", type: "address", internalType: "address" }, { name: "amount", type: "uint256", internalType: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "updateFeeRecipient", inputs: [{ name: "newFeeRecipient", type: "address", internalType: "address" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getPlan", inputs: [{ name: "planId", type: "uint256", internalType: "uint256" }], outputs: [{ name: "", type: "tuple", internalType: "struct SubscriptionLib.Plan", components: [{ name: "merchant", type: "address", internalType: "address" }, { name: "active", type: "bool", internalType: "bool" }, { name: "trialDuration", type: "uint48", internalType: "uint48" }, { name: "price", type: "uint256", internalType: "uint256" }, { name: "interval", type: "uint256", internalType: "uint256" }] }], stateMutability: "view" },
  { type: "function", name: "migratePlan", inputs: [{ name: "currentPlanId", type: "uint256", internalType: "uint256" }, { name: "newPlanId", type: "uint256", internalType: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getSubscription", inputs: [{ name: "planId", type: "uint256", internalType: "uint256" }, { name: "subscriber", type: "address", internalType: "address" }], outputs: [{ name: "", type: "tuple", internalType: "struct SubscriptionLib.Subscription", components: [{ name: "nextChargeTimestamp", type: "uint48", internalType: "uint48" }, { name: "active", type: "bool", internalType: "bool" }] }], stateMutability: "view" },
  { type: "function", name: "isChargeDue", inputs: [{ name: "planId", type: "uint256", internalType: "uint256" }, { name: "subscriber", type: "address", internalType: "address" }], outputs: [{ name: "", type: "bool", internalType: "bool" }], stateMutability: "view" },
  { type: "function", name: "subscriptionNFT", inputs: [], outputs: [{ name: "", type: "address", internalType: "address" }], stateMutability: "view" },
  { type: "function", name: "isSubscribed", inputs: [{ name: "subscriber", type: "address", internalType: "address" }, { name: "planId", type: "uint256", internalType: "uint256" }], outputs: [{ name: "", type: "bool", internalType: "bool" }], stateMutability: "view" },
  { type: "function", name: "subscribe", inputs: [{ name: "planId", type: "uint256", internalType: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "event", name: "PaymentCharged", inputs: [{ name: "planId", type: "uint256", indexed: true, internalType: "uint256" }, { name: "subscriber", type: "address", indexed: true, internalType: "address" }, { name: "merchant", type: "address", indexed: true, internalType: "address" }, { name: "amount", type: "uint256", indexed: false, internalType: "uint256" }, { name: "nextChargeTimestamp", type: "uint256", indexed: false, internalType: "uint256" }], anonymous: false },
  { type: "event", name: "FeeCollected", inputs: [{ name: "planId", type: "uint256", indexed: true, internalType: "uint256" }, { name: "subscriber", type: "address", indexed: true, internalType: "address" }, { name: "feeAmount", type: "uint256", indexed: false, internalType: "uint256" }], anonymous: false },
  { type: "event", name: "PaymentSent", inputs: [{ name: "sender", type: "address", indexed: true, internalType: "address" }, { name: "recipient", type: "address", indexed: true, internalType: "address" }, { name: "amount", type: "uint256", indexed: false, internalType: "uint256" }, { name: "fee", type: "uint256", indexed: false, internalType: "uint256" }], anonymous: false },
  { type: "event", name: "PlanCreated", inputs: [{ name: "planId", type: "uint256", indexed: true, internalType: "uint256" }, { name: "merchant", type: "address", indexed: true, internalType: "address" }, { name: "price", type: "uint256", indexed: false, internalType: "uint256" }, { name: "interval", type: "uint256", indexed: false, internalType: "uint256" }], anonymous: false },
  { type: "event", name: "PlanDeactivated", inputs: [{ name: "planId", type: "uint256", indexed: true, internalType: "uint256" }, { name: "merchant", type: "address", indexed: true, internalType: "address" }], anonymous: false },
  { type: "event", name: "SubscriptionCancelled", inputs: [{ name: "planId", type: "uint256", indexed: true, internalType: "uint256" }, { name: "subscriber", type: "address", indexed: true, internalType: "address" }], anonymous: false },
  { type: "event", name: "PlanMigrated", inputs: [{ name: "fromPlanId", type: "uint256", indexed: true, internalType: "uint256" }, { name: "toPlanId", type: "uint256", indexed: true, internalType: "uint256" }, { name: "subscriber", type: "address", indexed: true, internalType: "address" }], anonymous: false },
  { type: "event", name: "SubscriptionCreated", inputs: [{ name: "planId", type: "uint256", indexed: true, internalType: "uint256" }, { name: "subscriber", type: "address", indexed: true, internalType: "address" }, { name: "nextChargeTimestamp", type: "uint256", indexed: false, internalType: "uint256" }], anonymous: false },
  { type: "error", name: "AlreadySubscribed", inputs: [{ name: "planId", type: "uint256", internalType: "uint256" }, { name: "subscriber", type: "address", internalType: "address" }] },
  { type: "error", name: "ArrayLengthMismatch", inputs: [] },
  { type: "error", name: "SamePlan", inputs: [{ name: "planId", type: "uint256", internalType: "uint256" }] },
  { type: "error", name: "InsufficientAllowance", inputs: [{ name: "subscriber", type: "address", internalType: "address" }, { name: "required", type: "uint256", internalType: "uint256" }, { name: "actual", type: "uint256", internalType: "uint256" }] },
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "InvalidInterval", inputs: [] },
  { type: "error", name: "InvalidPrice", inputs: [] },
  { type: "error", name: "PaymentNotDue", inputs: [{ name: "planId", type: "uint256", internalType: "uint256" }, { name: "subscriber", type: "address", internalType: "address" }, { name: "nextChargeTimestamp", type: "uint256", internalType: "uint256" }] },
  { type: "error", name: "PlanInactive", inputs: [{ name: "planId", type: "uint256", internalType: "uint256" }] },
  { type: "error", name: "PlanNotFound", inputs: [{ name: "planId", type: "uint256", internalType: "uint256" }] },
  { type: "error", name: "ReentrancyGuardReentrantCall", inputs: [] },
  { type: "error", name: "SubscriptionInactive", inputs: [{ name: "planId", type: "uint256", internalType: "uint256" }, { name: "subscriber", type: "address", internalType: "address" }] },
  { type: "error", name: "TransferFailed", inputs: [{ name: "from", type: "address", internalType: "address" }, { name: "to", type: "address", internalType: "address" }, { name: "amount", type: "uint256", internalType: "uint256" }] },
  { type: "error", name: "Unauthorized", inputs: [{ name: "caller", type: "address", internalType: "address" }] },
  { type: "error", name: "ZeroAddress", inputs: [] }
];
var SUBSCRIPTION_NFT_ABI = [
  // ── View functions ────────────────────────────────────────────────────────
  { type: "function", name: "owner", inputs: [], outputs: [{ name: "", type: "address", internalType: "address" }], stateMutability: "view" },
  { type: "function", name: "isSubscribed", inputs: [{ name: "subscriber", type: "address", internalType: "address" }, { name: "planId", type: "uint256", internalType: "uint256" }], outputs: [{ name: "", type: "bool", internalType: "bool" }], stateMutability: "view" },
  { type: "function", name: "tokenOfSubscriber", inputs: [{ name: "subscriber", type: "address", internalType: "address" }, { name: "planId", type: "uint256", internalType: "uint256" }], outputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }], stateMutability: "view" },
  { type: "function", name: "tokenURI", inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }], outputs: [{ name: "", type: "string", internalType: "string" }], stateMutability: "view" },
  { type: "function", name: "ownerOf", inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }], outputs: [{ name: "", type: "address", internalType: "address" }], stateMutability: "view" },
  { type: "function", name: "name", inputs: [], outputs: [{ name: "", type: "string", internalType: "string" }], stateMutability: "view" },
  { type: "function", name: "symbol", inputs: [], outputs: [{ name: "", type: "string", internalType: "string" }], stateMutability: "view" },
  // ── Owner-only write functions ─────────────────────────────────────────────
  { type: "function", name: "mint", inputs: [{ name: "subscriber", type: "address", internalType: "address" }, { name: "planId", type: "uint256", internalType: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "burn", inputs: [{ name: "subscriber", type: "address", internalType: "address" }, { name: "planId", type: "uint256", internalType: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "transferOwnership", inputs: [{ name: "newOwner", type: "address", internalType: "address" }], outputs: [], stateMutability: "nonpayable" },
  // ── Events ────────────────────────────────────────────────────────────────
  { type: "event", name: "Minted", inputs: [{ name: "subscriber", type: "address", indexed: true, internalType: "address" }, { name: "planId", type: "uint256", indexed: true, internalType: "uint256" }, { name: "tokenId", type: "uint256", indexed: false, internalType: "uint256" }], anonymous: false },
  { type: "event", name: "Burned", inputs: [{ name: "subscriber", type: "address", indexed: true, internalType: "address" }, { name: "planId", type: "uint256", indexed: true, internalType: "uint256" }, { name: "tokenId", type: "uint256", indexed: false, internalType: "uint256" }], anonymous: false },
  { type: "event", name: "OwnershipTransferred", inputs: [{ name: "previousOwner", type: "address", indexed: true, internalType: "address" }, { name: "newOwner", type: "address", indexed: true, internalType: "address" }], anonymous: false },
  // ── Errors ────────────────────────────────────────────────────────────────
  { type: "error", name: "AlreadySubscribed", inputs: [] },
  { type: "error", name: "NotSubscribed", inputs: [] },
  { type: "error", name: "Soulbound", inputs: [] },
  { type: "error", name: "Unauthorized", inputs: [] }
];
var USDC_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ type: "bool" }]
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ type: "uint256" }]
  }
];

// src/utils.ts
var USDC_DECIMALS = 6n;
var USDC_SCALE = 10n ** USDC_DECIMALS;
function toUsdcUnits(amount) {
  return BigInt(Math.round(amount * Number(USDC_SCALE)));
}
function fromUsdcUnits(amount) {
  return Number(amount) / Number(USDC_SCALE);
}
function daysToSeconds(days) {
  return BigInt(days * 86400);
}
function secondsToDays(seconds) {
  return Number(seconds) / 86400;
}

// src/client.ts
var ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
var CycloClient = class {
  constructor(config) {
    this.listeners = /* @__PURE__ */ new Map();
    this.unwatchers = [];
    this.contractAddress = config.contractAddress;
    this.usdcAddress = config.usdcAddress;
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    if (config.subscriptionNFTAddress) {
      this._resolvedNftAddress = config.subscriptionNFTAddress;
    }
  }
  setWalletClient(walletClient) {
    this.walletClient = walletClient;
  }
  // ─── Plans ────────────────────────────────────────────────────────────────
  async getPlan(planId) {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: "getPlan",
      args: [planId]
    });
    return {
      id: planId,
      merchant: result.merchant,
      price: result.price,
      priceUsdc: fromUsdcUnits(result.price),
      interval: result.interval,
      intervalDays: secondsToDays(result.interval),
      trialDuration: BigInt(result.trialDuration),
      trialDays: result.trialDuration / 86400,
      active: result.active
    };
  }
  async createPlan(params) {
    const wallet = this.requireWallet();
    const [account] = await wallet.getAddresses();
    const price = toUsdcUnits(params.price);
    const interval = daysToSeconds(params.intervalDays);
    const trial = daysToSeconds(params.trialDays ?? 0);
    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: "createPlan",
      args: [price, interval, Number(trial)],
      account,
      chain: wallet.chain
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({
      abi: SUBSCRIPTION_MANAGER_ABI,
      logs: receipt.logs,
      eventName: "PlanCreated"
    });
    if (logs.length === 0) throw new Error("PlanCreated event not found in receipt");
    return logs[0].args.planId;
  }
  async deactivatePlan(planId) {
    const wallet = this.requireWallet();
    const [account] = await wallet.getAddresses();
    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: "deactivatePlan",
      args: [planId],
      account,
      chain: wallet.chain
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
  }
  getSubscribeLink(planId, baseUrl) {
    const base = baseUrl.replace(/\/$/, "");
    return `${base}/subscribe/${planId.toString()}`;
  }
  // ─── Subscriptions ────────────────────────────────────────────────────────
  async getSubscription(subscriber, planId) {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: "getSubscription",
      args: [planId, subscriber]
    });
    return {
      planId,
      subscriber,
      nextChargeTimestamp: BigInt(result.nextChargeTimestamp),
      active: result.active
    };
  }
  /**
   * Subscribes the connected wallet to the given plan.
   *
   * @param planId      - Plan to subscribe to
   * @param onBroadcast - Optional callback fired after the subscribe transaction
   *                      is signed and broadcast but before on-chain confirmation.
   *                      Use this to switch UI from "awaiting wallet" to
   *                      "awaiting confirmation" without polling.
   */
  async subscribe(planId, onBroadcast) {
    const wallet = this.requireWallet();
    const [account] = await wallet.getAddresses();
    await this.ensureAllowance(account, planId);
    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: "subscribe",
      args: [planId],
      account,
      chain: wallet.chain
    });
    onBroadcast?.();
    await this.publicClient.waitForTransactionReceipt({ hash });
  }
  async cancelSubscription(planId) {
    const wallet = this.requireWallet();
    const [account] = await wallet.getAddresses();
    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: "cancelSubscription",
      args: [planId],
      account,
      chain: wallet.chain
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
  }
  async migratePlan(currentPlanId, newPlanId) {
    const wallet = this.requireWallet();
    const [account] = await wallet.getAddresses();
    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: "migratePlan",
      args: [currentPlanId, newPlanId],
      account,
      chain: wallet.chain
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
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
  async isSubscribed(subscriber, planId) {
    const nftAddress = await this.resolveNftAddress();
    if (nftAddress === ZERO_ADDRESS) return false;
    return await this.publicClient.readContract({
      address: nftAddress,
      abi: SUBSCRIPTION_NFT_ABI,
      functionName: "isSubscribed",
      args: [subscriber, planId]
    });
  }
  /**
   * Returns the tokenId of the soulbound NFT held by `subscriber` for `planId`,
   * or null if the subscriber does not hold a token (not subscribed, or NFT not configured).
   */
  async getSubscriberTokenId(subscriber, planId) {
    const nftAddress = await this.resolveNftAddress();
    if (nftAddress === ZERO_ADDRESS) return null;
    const subscribed = await this.publicClient.readContract({
      address: nftAddress,
      abi: SUBSCRIPTION_NFT_ABI,
      functionName: "isSubscribed",
      args: [subscriber, planId]
    });
    if (!subscribed) return null;
    return await this.publicClient.readContract({
      address: nftAddress,
      abi: SUBSCRIPTION_NFT_ABI,
      functionName: "tokenOfSubscriber",
      args: [subscriber, planId]
    });
  }
  // ─── Events ───────────────────────────────────────────────────────────────
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
      this.watchEvent(event);
    }
    this.listeners.get(event).push(callback);
    return () => {
      const list = this.listeners.get(event) ?? [];
      const idx = list.indexOf(callback);
      if (idx !== -1) list.splice(idx, 1);
    };
  }
  destroy() {
    this.unwatchers.forEach((u) => u());
    this.unwatchers = [];
    this.listeners.clear();
  }
  // ─── Private ──────────────────────────────────────────────────────────────
  requireWallet() {
    if (!this.walletClient) throw new Error("walletClient required for write operations");
    return this.walletClient;
  }
  /**
   * Resolves the SubscriptionNFT contract address.
   * Uses the config-provided address when available. Otherwise reads from the
   * SubscriptionManager and caches any non-zero result for subsequent calls.
   */
  async resolveNftAddress() {
    if (this._resolvedNftAddress !== void 0) return this._resolvedNftAddress;
    const addr = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: "subscriptionNFT"
    });
    if (addr !== ZERO_ADDRESS) {
      this._resolvedNftAddress = addr;
    }
    return addr;
  }
  async ensureAllowance(account, planId) {
    const plan = await this.getPlan(planId);
    const required = plan.price * 12n;
    const allowance = await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: "allowance",
      args: [account, this.contractAddress]
    });
    if (allowance >= plan.price * 2n) return;
    const wallet = this.requireWallet();
    const hash = await wallet.writeContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: "approve",
      args: [this.contractAddress, required],
      account,
      chain: wallet.chain
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
  }
  watchEvent(event) {
    const unwatch = this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: SUBSCRIPTION_MANAGER_ABI,
      eventName: event,
      onLogs: (logs) => {
        const callbacks = this.listeners.get(event) ?? [];
        logs.forEach((log) => callbacks.forEach((cb) => cb(log.args)));
      }
    });
    this.unwatchers.push(unwatch);
  }
};
export {
  CycloClient,
  SUBSCRIPTION_MANAGER_ABI,
  SUBSCRIPTION_NFT_ABI,
  daysToSeconds,
  fromUsdcUnits,
  secondsToDays,
  toUsdcUnits
};
//# sourceMappingURL=index.js.map