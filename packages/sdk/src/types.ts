import type { PublicClient, WalletClient } from 'viem'

export interface CycloClientConfig {
  contractAddress: `0x${string}`
  usdcAddress: `0x${string}`
  publicClient: PublicClient
  walletClient?: WalletClient
  /**
   * Address of the deployed SubscriptionNFT contract.
   * When provided, isSubscribed() and getSubscriberTokenId() use this directly
   * without an extra RPC call to read it from the SubscriptionManager.
   * When omitted, the address is read from subscriptionManager.subscriptionNFT()
   * on first use and cached for subsequent calls.
   */
  subscriptionNFTAddress?: `0x${string}`
}

export interface Plan {
  id: bigint
  merchant: `0x${string}`
  price: bigint
  priceUsdc: number
  interval: bigint
  intervalDays: number
  trialDuration: bigint
  trialDays: number
  active: boolean
}

export interface Subscription {
  planId: bigint
  subscriber: `0x${string}`
  nextChargeTimestamp: bigint
  active: boolean
}

export interface CreatePlanParams {
  price: number
  intervalDays: number
  trialDays?: number
}

export type CycloEventName =
  | 'PaymentCharged'
  | 'SubscriptionCreated'
  | 'SubscriptionCancelled'
  | 'PlanCreated'
  | 'PlanDeactivated'
  | 'PlanMigrated'

export type CycloEventCallback<T = unknown> = (data: T) => void
