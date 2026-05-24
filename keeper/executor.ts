import pLimit from 'p-limit'
import type { Contract } from 'ethers'
import { NonceManager } from './nonce.js'
import {
  markPastDue,
  markSuspended,
  cancelSubscription,
  insertExecutionLog,
} from './db/queries.js'
import { log } from './logger.js'
import { buildPaymentChargedPayload, emitPaymentCharged } from './apiEmitter.js'

export interface WorkItem {
  planId: bigint
  subscriber: string
}

interface PreFlightResult {
  item: WorkItem
  ready: boolean
  reason: number
}

// Reason codes from checkPreFlight()
const REASON = { READY: 0, NOT_DUE: 1, LOW_BALANCE: 2, LOW_ALLOWANCE: 3, INACTIVE: 4 } as const

const CONCURRENCY       = parseInt(process.env.EXECUTOR_CONCURRENCY    ?? '20')
const BATCH_SIZE        = parseInt(process.env.EXECUTOR_BATCH_SIZE      ?? '50')
const MAX_BATCH_RETRIES = parseInt(process.env.EXECUTOR_MAX_RETRIES     ?? '3')

export class ExecutorPool {
  private contract: Contract
  private nonceManager: NonceManager
  private limit = pLimit(CONCURRENCY)

  constructor(contract: Contract, nonceManager: NonceManager) {
    this.contract = contract
    this.nonceManager = nonceManager
  }

  /**
   * Main entry point.
   * 1. Fan out pre-flight checks concurrently (capped at CONCURRENCY).
   * 2. Triage results by reason code.
   * 3. Split ready items into chunks of BATCH_SIZE.
   * 4. Execute each chunk sequentially so nonces don't collide.
   */
  async run(items: WorkItem[]): Promise<void> {
    if (items.length === 0) return

    log('info', 'ExecutorPool starting', {
      total: items.length,
      concurrency: CONCURRENCY,
      batchSize: BATCH_SIZE,
    })

    // ── Phase 1: concurrent pre-flight checks ──────────────────────────────
    const results: PreFlightResult[] = await Promise.all(
      items.map(item =>
        this.limit(() => this.preflight(item))
      )
    )

    // ── Phase 2: triage ────────────────────────────────────────────────────
    const ready: WorkItem[] = []

    await Promise.all(
      results.map(async ({ item, ready: isReady, reason }) => {
        if (isReady) {
          ready.push(item)
          return
        }

        switch (reason) {
          case REASON.NOT_DUE:
            // Silent — normal state
            break

          case REASON.LOW_BALANCE:
            log('warn', 'Pre-flight: low balance', {
              planId: item.planId.toString(),
              subscriber: item.subscriber,
            })
            await markPastDue(item.planId.toString(), item.subscriber)
            await insertExecutionLog({
              planId: item.planId.toString(),
              subscriber: item.subscriber,
              status: 'skipped',
              reasonCode: reason,
            })
            break

          case REASON.LOW_ALLOWANCE:
            log('warn', 'Pre-flight: allowance revoked', {
              planId: item.planId.toString(),
              subscriber: item.subscriber,
            })
            await markSuspended(item.planId.toString(), item.subscriber)
            await insertExecutionLog({
              planId: item.planId.toString(),
              subscriber: item.subscriber,
              status: 'skipped',
              reasonCode: reason,
            })
            break

          case REASON.INACTIVE:
            await cancelSubscription(item.planId.toString(), item.subscriber)
            await insertExecutionLog({
              planId: item.planId.toString(),
              subscriber: item.subscriber,
              status: 'skipped',
              reasonCode: reason,
            })
            break

          default:
            log('warn', 'Pre-flight: unknown reason', {
              planId: item.planId.toString(),
              subscriber: item.subscriber,
              reason,
            })
        }
      })
    )

    if (ready.length === 0) {
      log('info', 'No subscriptions ready after pre-flight', {
        checked: items.length,
      })
      return
    }

    log('info', 'Pre-flight complete', {
      checked: items.length,
      ready: ready.length,
      skipped: items.length - ready.length,
    })

    // ── Phase 3: chunk and execute ─────────────────────────────────────────
    const chunks = chunkArray(ready, BATCH_SIZE)
    log('info', 'Executing batches', { chunks: chunks.length, batchSize: BATCH_SIZE })

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      log('info', `Executing batch ${i + 1}/${chunks.length}`, { size: chunk.length })
      await this.executeChunk(chunk, 1)
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async preflight(item: WorkItem): Promise<PreFlightResult> {
    try {
      const [ready, reason] = await this.contract.checkPreFlight(
        item.planId,
        item.subscriber
      )
      return { item, ready, reason: Number(reason) }
    } catch (err) {
      log('warn', 'checkPreFlight RPC error', {
        planId: item.planId.toString(),
        subscriber: item.subscriber,
        err: String(err),
      })
      return { item, ready: false, reason: -1 }
    }
  }

  private async executeChunk(chunk: WorkItem[], attempt: number): Promise<void> {
    const planIds     = chunk.map(c => c.planId)
    const subscribers = chunk.map(c => c.subscriber)

    const nonce = await this.nonceManager.next()

    try {
      const tx = await this.contract.batchCharge(planIds, subscribers, { nonce })

      log('info', 'batchCharge submitted', {
        hash: tx.hash,
        count: chunk.length,
        nonce,
        attempt,
      })

      const receipt = await tx.wait()

      // Count successes by parsing PaymentCharged events in the receipt
      const successSet = new Set<string>()
      const emitQueue: ReturnType<typeof emitPaymentCharged>[] = []

      for (const rlog of receipt.logs) {
        try {
          const parsed = this.contract.interface.parseLog(rlog)
          if (parsed?.name === 'PaymentCharged') {
            const { planId, subscriber, amount } = parsed.args
            const key = `${planId.toString()}:${subscriber.toLowerCase()}`
            successSet.add(key)
            await insertExecutionLog({
              txHash: tx.hash,
              planId: planId.toString(),
              subscriber,
              status: 'success',
              amount: amount.toString(),
              blockNumber: BigInt(receipt.blockNumber),
            })
            // Queue a payment.charged Socket.io event for this charge.
            // Emits are batched below so DB writes finish first.
            emitQueue.push(
              emitPaymentCharged(
                buildPaymentChargedPayload({
                  planId,
                  subscriber,
                  rawAmount: amount,
                  txHash: tx.hash,
                })
              )
            )
          }
        } catch {
          // Not a contract log — skip
        }
      }

      // Log failures (submitted but no PaymentCharged emitted)
      for (const item of chunk) {
        const key = `${item.planId.toString()}:${item.subscriber.toLowerCase()}`
        if (!successSet.has(key)) {
          await insertExecutionLog({
            txHash: tx.hash,
            planId: item.planId.toString(),
            subscriber: item.subscriber,
            status: 'failed',
            blockNumber: BigInt(receipt.blockNumber),
          })
        }
      }

      // Broadcast all payment.charged events concurrently after DB writes.
      // emitPaymentCharged is fail-silent — errors are logged, not thrown.
      await Promise.all(emitQueue)

      log('info', 'batchCharge confirmed', {
        hash: tx.hash,
        submitted: chunk.length,
        charged: successSet.size,
        failed: chunk.length - successSet.size,
        nonce,
      })

      await this.nonceManager.sync()

    } catch (err) {
      const msg = String(err)

      // Nonce error — reset and retry
      if ((msg.includes('nonce') || msg.includes('replacement')) && attempt < MAX_BATCH_RETRIES) {
        log('warn', 'Nonce error — resetting and retrying', { attempt, err: msg })
        await this.nonceManager.reset()
        return this.executeChunk(chunk, attempt + 1)
      }

      // RPC timeout — exponential backoff retry
      if ((msg.includes('timeout') || msg.includes('network')) && attempt < MAX_BATCH_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000
        log('warn', `RPC error — retrying in ${delay}ms`, { attempt, err: msg })
        await sleep(delay)
        return this.executeChunk(chunk, attempt + 1)
      }

      // Hard failure — log each item
      log('error', 'batchCharge hard fail', {
        err: msg,
        count: chunk.length,
        attempt,
      })

      await Promise.all(
        chunk.map(item =>
          insertExecutionLog({
            planId: item.planId.toString(),
            subscriber: item.subscriber,
            status: 'failed',
            error: msg,
          })
        )
      )
    }
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
