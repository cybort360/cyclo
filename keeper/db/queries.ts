import { getPool } from './client.js'

export interface DbSubscription {
  plan_id: string
  subscriber: string
  next_charge_timestamp: bigint
  status: string
  failed_at: bigint | null
  retry_count: number
  last_retry: bigint | null
}

export interface DbBlock {
  block_number: bigint
  block_hash: string
}

// ─── Keeper state ─────────────────────────────────────────────────────────────

export async function getLastBlock(): Promise<number> {
  const result = await getPool().query(
    `SELECT value FROM keeper_state WHERE key = 'last_block'`
  )
  return result.rows[0] ? parseInt(result.rows[0].value) : 0
}

export async function setLastBlock(blockNumber: number): Promise<void> {
  await getPool().query(
    `INSERT INTO keeper_state (key, value, updated_at)
     VALUES ('last_block', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [blockNumber.toString()]
  )
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function upsertSubscription(
  planId: string,
  subscriber: string,
  nextChargeTimestamp: bigint
): Promise<void> {
  await getPool().query(
    `INSERT INTO subscriptions (plan_id, subscriber, next_charge_timestamp, status, updated_at)
     VALUES ($1, $2, $3, 'active', NOW())
     ON CONFLICT (plan_id, subscriber) DO UPDATE
       SET next_charge_timestamp = $3,
           status = 'active',
           updated_at = NOW()`,
    [planId, subscriber.toLowerCase(), nextChargeTimestamp.toString()]
  )
}

export async function cancelSubscription(planId: string, subscriber: string): Promise<void> {
  await getPool().query(
    `UPDATE subscriptions
     SET status = 'cancelled', updated_at = NOW()
     WHERE plan_id = $1 AND subscriber = $2`,
    [planId, subscriber.toLowerCase()]
  )
}

export async function getActiveSubscriptions(): Promise<DbSubscription[]> {
  const result = await getPool().query(
    `SELECT * FROM subscriptions WHERE status = 'active'`
  )
  return result.rows
}

export async function getPastDueForRetry(nowMs: number, retryIntervalMs: number): Promise<DbSubscription[]> {
  const cutoff = Math.floor((nowMs - retryIntervalMs) / 1000)
  const result = await getPool().query(
    `SELECT * FROM subscriptions
     WHERE status = 'past_due'
       AND (last_retry IS NULL OR last_retry <= $1)`,
    [cutoff]
  )
  return result.rows
}

export async function markPastDue(planId: string, subscriber: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await getPool().query(
    `UPDATE subscriptions
     SET status = 'past_due',
         failed_at = COALESCE(failed_at, $3),
         last_retry = $3,
         updated_at = NOW()
     WHERE plan_id = $1 AND subscriber = $2`,
    [planId, subscriber.toLowerCase(), now]
  )
}

export async function incrementGraceRetry(planId: string, subscriber: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await getPool().query(
    `UPDATE subscriptions
     SET retry_count = retry_count + 1,
         last_retry = $3,
         updated_at = NOW()
     WHERE plan_id = $1 AND subscriber = $2`,
    [planId, subscriber.toLowerCase(), now]
  )
}

export async function markSuspended(planId: string, subscriber: string): Promise<void> {
  await getPool().query(
    `UPDATE subscriptions
     SET status = 'suspended', updated_at = NOW()
     WHERE plan_id = $1 AND subscriber = $2`,
    [planId, subscriber.toLowerCase()]
  )
}

export async function markActive(planId: string, subscriber: string): Promise<void> {
  await getPool().query(
    `UPDATE subscriptions
     SET status = 'active',
         retry_count = 0,
         failed_at = NULL,
         last_retry = NULL,
         updated_at = NOW()
     WHERE plan_id = $1 AND subscriber = $2`,
    [planId, subscriber.toLowerCase()]
  )
}

// ─── Execution logs ───────────────────────────────────────────────────────────

export async function insertExecutionLog(entry: {
  txHash?: string
  planId: string
  subscriber: string
  status: 'success' | 'failed' | 'skipped'
  reasonCode?: number
  amount?: string
  error?: string
  blockNumber?: bigint
}): Promise<void> {
  await getPool().query(
    `INSERT INTO execution_logs
       (tx_hash, plan_id, subscriber, status, reason_code, amount, error, block_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.txHash ?? null,
      entry.planId,
      entry.subscriber.toLowerCase(),
      entry.status,
      entry.reasonCode ?? null,
      entry.amount ?? null,
      entry.error ?? null,
      entry.blockNumber?.toString() ?? null,
    ]
  )
}

// ─── Block history ────────────────────────────────────────────────────────────

export async function insertBlock(blockNumber: bigint, blockHash: string): Promise<void> {
  await getPool().query(
    `INSERT INTO block_history (block_number, block_hash)
     VALUES ($1, $2)
     ON CONFLICT (block_number) DO NOTHING`,
    [blockNumber.toString(), blockHash]
  )
}

export async function getBlock(blockNumber: bigint): Promise<DbBlock | null> {
  const result = await getPool().query(
    `SELECT block_number, block_hash FROM block_history WHERE block_number = $1`,
    [blockNumber.toString()]
  )
  if (!result.rows[0]) return null
  return {
    block_number: BigInt(result.rows[0].block_number),
    block_hash: result.rows[0].block_hash,
  }
}

export async function deleteBlocksFrom(blockNumber: bigint): Promise<void> {
  await getPool().query(
    `DELETE FROM block_history WHERE block_number >= $1`,
    [blockNumber.toString()]
  )
}

export async function rollbackSubscriptionsFrom(blockNumber: bigint): Promise<void> {
  // On reorg, revert any subscription state changes that came from orphaned blocks.
  // The safest approach: mark affected subscriptions for resync from chain.
  await getPool().query(
    `UPDATE subscriptions
     SET status = 'active', updated_at = NOW()
     WHERE status = 'cancelled'
       AND updated_at > (
         SELECT processed_at FROM block_history WHERE block_number = $1
       )`,
    [blockNumber.toString()]
  )
}
