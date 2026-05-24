import { type Contract, type Provider, type Signer } from 'ethers'
import { log } from './logger.js'
import { NonceManager } from './nonce.js'
import { ReorgDetector } from './reorg.js'
import { ExecutorPool, type WorkItem } from './executor.js'
import {
  getLastBlock,
  setLastBlock,
  upsertSubscription,
  cancelSubscription,
  getActiveSubscriptions,
  getPastDueForRetry,
  markPastDue,
  markSuspended,
  markActive,
  incrementGraceRetry,
  insertExecutionLog,
} from './db/queries.js'

// ─── Constants ────────────────────────────────────────────────────────────────

// Reason codes from checkPreFlight()
const REASON = { READY: 0, NOT_DUE: 1, LOW_BALANCE: 2, LOW_ALLOWANCE: 3, INACTIVE: 4 } as const

// Only validate the most recent N blocks for reorgs — older blocks are finalized
const REORG_VALIDATION_WINDOW = 100

// ─── Scheduler ────────────────────────────────────────────────────────────────

export class Scheduler {
  private contract: Contract
  private signer: Signer
  private provider: Provider
  private nonceManager: NonceManager
  private reorgDetector: ReorgDetector
  private executor: ExecutorPool
  private deployBlock: number

  constructor(
    contract: Contract,
    signer: Signer,
    provider: Provider,
    nonceManager: NonceManager,
    reorgDetector: ReorgDetector,
    executor: ExecutorPool,
    deployBlock: number
  ) {
    this.contract = contract
    this.signer = signer
    this.provider = provider
    this.nonceManager = nonceManager
    this.reorgDetector = reorgDetector
    this.executor = executor
    this.deployBlock = deployBlock
    log('info', 'Scheduler initialised', { deployBlock })
  }

  // ─── Event sync ─────────────────────────────────────────────────────────────

  async syncEvents(): Promise<void> {
    const safeBlock = await this.reorgDetector.safeBlock()
    const lastBlock = await getLastBlock()
    const fromBlock = lastBlock === 0 ? this.deployBlock : lastBlock + 1

    if (fromBlock > safeBlock) {
      log('info', 'No new confirmed blocks to process', { lastBlock, safeBlock })
      return
    }

    log('info', 'Syncing confirmed blocks', { fromBlock, toBlock: safeBlock })

    // Historical blocks are finalized — only validate the recent window
    const validationStart = Math.max(fromBlock, safeBlock - REORG_VALIDATION_WINDOW)

    if (validationStart > fromBlock) {
      log('info', 'Skipping reorg validation for historical range', {
        fromBlock,
        validationStart,
        blocks: validationStart - fromBlock,
      })
    }

    for (let blockNumber = validationStart; blockNumber <= safeBlock; blockNumber++) {
      const valid = await this.reorgDetector.validate(blockNumber)

      if (!valid) {
        const newLastBlock = await getLastBlock()
        log('warn', 'Reorg handled — will resync from new tip', { newLastBlock })
        return
      }
    }

    // Query all events across the full range (historical + recent)
    const [created, cancelled] = await Promise.all([
      this.contract.queryFilter(
        this.contract.filters.SubscriptionCreated(),
        fromBlock,
        safeBlock
      ),
      this.contract.queryFilter(
        this.contract.filters.SubscriptionCancelled(),
        fromBlock,
        safeBlock
      ),
    ])

    for (const event of created) {
      const { planId, subscriber, nextChargeTimestamp } = (event as any).args
      await upsertSubscription(planId.toString(), subscriber, nextChargeTimestamp)
      log('info', 'Subscription upserted', { planId: planId.toString(), subscriber })
    }

    for (const event of cancelled) {
      const { planId, subscriber } = (event as any).args
      await cancelSubscription(planId.toString(), subscriber)
      log('info', 'Subscription cancelled', { planId: planId.toString(), subscriber })
    }

    await setLastBlock(safeBlock)
    log('info', 'Sync complete', { toBlock: safeBlock })
  }

  // ─── Pre-flight check ────────────────────────────────────────────────────────

  private async checkPreFlight(
    planId: bigint,
    subscriber: string
  ): Promise<{ ready: boolean; reason: number }> {
    try {
      const [ready, reason] = await this.contract.checkPreFlight(planId, subscriber)
      return { ready, reason: Number(reason) }
    } catch (err) {
      log('warn', 'checkPreFlight RPC error', {
        planId: planId.toString(),
        subscriber,
        err: String(err),
      })
      return { ready: false, reason: -1 }
    }
  }

  // ─── Process due charges ─────────────────────────────────────────────────────

  async processDueCharges(): Promise<void> {
    const active = await getActiveSubscriptions()
    if (active.length === 0) {
      log('info', 'No active subscriptions')
      return
    }

    log('info', 'Running pre-flight checks', { count: active.length })

    const results = await Promise.all(
      active.map(async s => ({
        sub: s,
        ...(await this.checkPreFlight(BigInt(s.plan_id), s.subscriber)),
      }))
    )

    const ready: WorkItem[] = []

    for (const { sub, ready: isReady, reason } of results) {
      if (isReady) {
        ready.push({ planId: BigInt(sub.plan_id), subscriber: sub.subscriber } satisfies WorkItem)
        continue
      }

      switch (reason) {
        case REASON.NOT_DUE:
          break

        case REASON.LOW_BALANCE:
          log('warn', 'Low balance — grace period', { planId: sub.plan_id, subscriber: sub.subscriber })
          await markPastDue(sub.plan_id, sub.subscriber)
          await insertExecutionLog({
            planId: sub.plan_id, subscriber: sub.subscriber,
            status: 'skipped', reasonCode: reason,
          })
          break

        case REASON.LOW_ALLOWANCE:
          log('warn', 'Allowance revoked', { planId: sub.plan_id, subscriber: sub.subscriber })
          await markSuspended(sub.plan_id, sub.subscriber)
          await insertExecutionLog({
            planId: sub.plan_id, subscriber: sub.subscriber,
            status: 'skipped', reasonCode: reason,
          })
          break

        case REASON.INACTIVE:
          await cancelSubscription(sub.plan_id, sub.subscriber)
          break
      }
    }

    if (ready.length === 0) {
      log('info', 'No subscriptions ready to charge')
      return
    }

    log('info', 'Charging ready subscriptions', { count: ready.length })
    await this.executor.run(ready)
  }

  // ─── Grace period retry ───────────────────────────────────────────────────────

  async processGracePeriod(): Promise<void> {
    const RETRY_INTERVAL_MS = 24 * 60 * 60 * 1000
    const MAX_RETRIES = 3

    const due = await getPastDueForRetry(Date.now(), RETRY_INTERVAL_MS)
    if (due.length === 0) return

    log('info', 'Processing grace period retries', { count: due.length })

    for (const entry of due) {
      const { ready, reason } = await this.checkPreFlight(
        BigInt(entry.plan_id),
        entry.subscriber
      )

      if (ready) {
        log('info', 'Grace period resolved — charging', {
          planId: entry.plan_id, subscriber: entry.subscriber,
        })
        await this.executor.run([{ planId: BigInt(entry.plan_id), subscriber: entry.subscriber }])
        await markActive(entry.plan_id, entry.subscriber)
        continue
      }

      if (reason === REASON.INACTIVE || reason === REASON.LOW_ALLOWANCE) {
        await markSuspended(entry.plan_id, entry.subscriber)
        log('warn', 'Grace period hard fail — suspended', {
          planId: entry.plan_id, subscriber: entry.subscriber, reason,
        })
        continue
      }

      await incrementGraceRetry(entry.plan_id, entry.subscriber)

      if (entry.retry_count + 1 >= MAX_RETRIES) {
        log('warn', 'Grace period exhausted — suspending', {
          planId: entry.plan_id, subscriber: entry.subscriber,
        })
        await markSuspended(entry.plan_id, entry.subscriber)
      } else {
        log('info', 'Grace retry incremented', {
          planId: entry.plan_id,
          subscriber: entry.subscriber,
          retryCount: entry.retry_count + 1,
        })
      }
    }
  }

}
