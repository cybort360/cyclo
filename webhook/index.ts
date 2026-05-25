/**
 * Webhook relay service.
 *
 * Polls Arc chain for PaymentCharged, SubscriptionCreated, and
 * SubscriptionCancelled events emitted by the SubscriptionManager contract,
 * then POSTs each event to every matching registered webhook URL stored in the
 * merchant_webhooks table.
 *
 * A webhook row matches an event when:
 *   - wallet_address equals the plan's merchant address
 *   - plan_id is '*' (catch-all) or equals the event's planId
 *   - active is true
 *
 * Each POST is signed with HMAC-SHA256 over the JSON body, delivered in the
 * X-Cyclo-Signature header as "sha256=<hex>" so receivers can verify origin.
 *
 * Required env vars (loaded from ../.env):
 *   ARC_RPC_URL, CONTRACT_ADDRESS, DATABASE_URL, DEPLOY_BLOCK,
 *   WEBHOOK_POLL_INTERVAL_MS
 *
 * Usage (from this folder): npm start
 */

import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { createHmac } from 'crypto';
import { JsonRpcProvider, Interface, type Log } from 'ethers';
import pg from 'pg';

// Load .env from the project root, regardless of cwd.
dotenv.config({ path: resolve(fileURLToPath(import.meta.url), '../../.env') });

const { Pool } = pg;

// ─── Logger ───────────────────────────────────────────────────────────────────

type Level = 'info' | 'warn' | 'error' | 'debug';

function log(level: Level, message: string, meta?: Record<string, unknown>): void {
    process.stdout.write(
        JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...meta }) + '\n'
    );
}

const logger = {
    info:  (msg: string, meta?: Record<string, unknown>): void => log('info',  msg, meta),
    warn:  (msg: string, meta?: Record<string, unknown>): void => log('warn',  msg, meta),
    error: (msg: string, meta?: Record<string, unknown>): void => log('error', msg, meta),
    debug: (msg: string, meta?: Record<string, unknown>): void => log('debug', msg, meta),
};

// ─── Environment ──────────────────────────────────────────────────────────────

const REQUIRED_ENV_VARS = [
    'ARC_RPC_URL',
    'CONTRACT_ADDRESS',
    'DATABASE_URL',
    'DEPLOY_BLOCK',
    'WEBHOOK_POLL_INTERVAL_MS',
] as const;

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

function validateEnv(): Record<string, string> {
    const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    return Object.fromEntries(
        REQUIRED_ENV_VARS.map((key) => [key, process.env[key] as string])
    );
}

// ─── Contract event ABIs ─────────────────────────────────────────────────────

// Human-readable event fragments — no dependency on the Foundry out/ directory.
const EVENT_FRAGMENTS = [
    'event PaymentCharged(uint256 indexed planId, address indexed subscriber, address indexed merchant, uint256 amount, uint256 nextChargeTimestamp)',
    'event SubscriptionCreated(uint256 indexed planId, address indexed subscriber, uint256 nextChargeTimestamp)',
    'event SubscriptionCancelled(uint256 indexed planId, address indexed subscriber)',
];

const iface = new Interface(EVENT_FRAGMENTS);

// ─── Types ───────────────────────────────────────────────────────────────────

type EventName = 'PaymentCharged' | 'SubscriptionCreated' | 'SubscriptionCancelled';

interface WebhookPayload {
    event:                EventName;
    planId:               string;
    subscriber:           string;
    merchant:             string;
    amount?:              string;
    nextChargeTimestamp?: string;
    txHash:               string;
    blockNumber:          number;
}

interface WebhookRow {
    id:             string;
    url:            string;
    secret:         string;
    plan_id:        string;
    wallet_address: string;
}

// ─── Database helpers ─────────────────────────────────────────────────────────

type DbPool = InstanceType<typeof Pool>;

let dbPool: DbPool | null = null;

function getPool(connectionString: string): DbPool {
    if (!dbPool) {
        dbPool = new Pool({
            connectionString,
            max:                     5,
            idleTimeoutMillis:       30_000,
            connectionTimeoutMillis: 5_000,
        });
        dbPool.on('error', (err) =>
            logger.error('DB pool error', { error: String(err) })
        );
    }
    return dbPool;
}

/**
 * Returns all active webhook rows for a given merchant + planId pair.
 * A row with plan_id='*' matches any plan for that merchant.
 */
async function getWebhooks(db: DbPool, merchant: string, planId: string): Promise<WebhookRow[]> {
    const result = await db.query<WebhookRow>(
        `SELECT id, url, secret, plan_id, wallet_address
         FROM merchant_webhooks
         WHERE lower(wallet_address) = lower($1)
           AND (plan_id = '*' OR plan_id = $2)
           AND active = true`,
        [merchant, planId]
    );
    return result.rows;
}

/**
 * Looks up the merchant address for a plan from the local plans table.
 * Used for events that do not include the merchant address in their log
 * (SubscriptionCreated, SubscriptionCancelled).
 */
async function getMerchantForPlan(db: DbPool, planId: string): Promise<string | null> {
    const result = await db.query<{ merchant: string }>(
        'SELECT merchant FROM plans WHERE plan_id = $1',
        [planId]
    );
    return result.rows[0]?.merchant ?? null;
}

/** Returns the last block processed by this service, falling back to deployBlock. */
async function getLastBlock(db: DbPool, deployBlock: number): Promise<number> {
    const result = await db.query<{ value: string }>(
        `SELECT value FROM keeper_state WHERE key = 'webhook_last_block'`
    );
    return result.rows[0] ? parseInt(result.rows[0].value, 10) : deployBlock;
}

/** Persists the last processed block so restarts resume from the right place. */
async function setLastBlock(db: DbPool, blockNumber: number): Promise<void> {
    await db.query(
        `INSERT INTO keeper_state (key, value, updated_at)
         VALUES ('webhook_last_block', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [String(blockNumber)]
    );
}

// ─── Webhook dispatch ─────────────────────────────────────────────────────────

/** Signs a serialised payload with HMAC-SHA256. */
function sign(secret: string, body: string): string {
    return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * POSTs a single webhook payload to one URL.
 * Never throws — delivery failures are logged and discarded so one bad URL
 * cannot block others in the fan-out.
 */
async function dispatch(webhook: WebhookRow, payload: WebhookPayload): Promise<void> {
    const body      = JSON.stringify(payload);
    const signature = sign(webhook.secret, body);

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 10_000);

    try {
        const response = await fetch(webhook.url, {
            method:  'POST',
            headers: {
                'Content-Type':      'application/json',
                'X-Cyclo-Signature': signature,
            },
            body,
            signal: controller.signal,
        });

        if (!response.ok) {
            logger.warn('Webhook delivery non-2xx', {
                webhookId: webhook.id,
                url:       webhook.url,
                status:    response.status,
                event:     payload.event,
            });
        } else {
            logger.info('Webhook delivered', {
                webhookId: webhook.id,
                url:       webhook.url,
                event:     payload.event,
                planId:    payload.planId,
            });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Webhook dispatch error', {
            webhookId: webhook.id,
            url:       webhook.url,
            error:     message,
        });
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Finds all active webhooks for merchant+planId and delivers the payload
 * to each one concurrently.
 */
async function fanOut(
    db:       DbPool,
    merchant: string,
    planId:   string,
    payload:  WebhookPayload
): Promise<void> {
    const webhooks = await getWebhooks(db, merchant, planId);
    if (webhooks.length === 0) return;
    await Promise.all(webhooks.map((wh) => dispatch(wh, payload)));
}

// ─── Event processing ─────────────────────────────────────────────────────────

// Arc RPC rejects queries spanning more than 100k blocks; use half that for safety.
const MAX_BLOCK_RANGE = 50_000;

/**
 * Fetches all three event types from [fromBlock, toBlock] in a single
 * getLogs call (OR-matched by topic hash) and fans out to registered webhooks.
 */
async function processRange(
    provider:        JsonRpcProvider,
    db:              DbPool,
    contractAddress: string,
    fromBlock:       number,
    toBlock:         number
): Promise<void> {
    const topicHashes = [
        iface.getEvent('PaymentCharged')!.topicHash,
        iface.getEvent('SubscriptionCreated')!.topicHash,
        iface.getEvent('SubscriptionCancelled')!.topicHash,
    ];

    const logs: Log[] = await provider.getLogs({
        address:   contractAddress,
        topics:    [topicHashes],
        fromBlock,
        toBlock,
    });

    logger.debug('Fetched logs', { fromBlock, toBlock, count: logs.length });

    for (const rawLog of logs) {
        try {
            await processLog(db, rawLog);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('Failed to process log', {
                txHash: rawLog.transactionHash,
                error:  message,
            });
        }
    }
}

/** Decodes one raw log and routes it to the appropriate fan-out. */
async function processLog(db: DbPool, rawLog: Log): Promise<void> {
    const parsed = iface.parseLog({ topics: [...rawLog.topics], data: rawLog.data });
    if (!parsed) return;

    const planId      = (parsed.args['planId'] as bigint).toString();
    const subscriber  = parsed.args['subscriber'] as string;
    const txHash      = rawLog.transactionHash;
    const blockNumber = rawLog.blockNumber;

    if (parsed.name === 'PaymentCharged') {
        const merchant   = parsed.args['merchant'] as string;
        const amount     = (parsed.args['amount'] as bigint).toString();
        const nextCharge = (parsed.args['nextChargeTimestamp'] as bigint).toString();

        await fanOut(db, merchant, planId, {
            event:               'PaymentCharged',
            planId,
            subscriber,
            merchant,
            amount,
            nextChargeTimestamp: nextCharge,
            txHash,
            blockNumber,
        });

    } else if (parsed.name === 'SubscriptionCreated') {
        const nextCharge = (parsed.args['nextChargeTimestamp'] as bigint).toString();
        // SubscriptionCreated does not carry merchant — look it up from plans table.
        const merchant   = await getMerchantForPlan(db, planId);
        if (!merchant) {
            // Plan not yet synced to DB; will be retried on the next poll once
            // the keeper has processed the same block.
            logger.warn('SubscriptionCreated: plan not found in DB, skipping', { planId, txHash });
            return;
        }
        await fanOut(db, merchant, planId, {
            event:               'SubscriptionCreated',
            planId,
            subscriber,
            merchant,
            nextChargeTimestamp: nextCharge,
            txHash,
            blockNumber,
        });

    } else if (parsed.name === 'SubscriptionCancelled') {
        const merchant = await getMerchantForPlan(db, planId);
        if (!merchant) {
            logger.warn('SubscriptionCancelled: plan not found in DB, skipping', { planId, txHash });
            return;
        }
        await fanOut(db, merchant, planId, {
            event:      'SubscriptionCancelled',
            planId,
            subscriber,
            merchant,
            txHash,
            blockNumber,
        });
    }
}

// ─── Main loop ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(baseMs: number): number {
    return Math.floor(Math.random() * 0.2 * baseMs);
}

async function main(): Promise<void> {
    const env = validateEnv();

    const intervalMs  = parseInt(env.WEBHOOK_POLL_INTERVAL_MS, 10);
    const deployBlock = parseInt(env.DEPLOY_BLOCK, 10);

    if (isNaN(intervalMs) || intervalMs <= 0) {
        throw new Error(
            `WEBHOOK_POLL_INTERVAL_MS must be a positive integer, got: "${env.WEBHOOK_POLL_INTERVAL_MS}"`
        );
    }
    if (isNaN(deployBlock) || deployBlock < 0) {
        throw new Error(
            `DEPLOY_BLOCK must be a non-negative integer, got: "${env.DEPLOY_BLOCK}"`
        );
    }

    const provider = new JsonRpcProvider(env.ARC_RPC_URL);
    const db       = getPool(env.DATABASE_URL);

    logger.info('Webhook relay starting', {
        contractAddress: env.CONTRACT_ADDRESS,
        intervalMs,
        deployBlock,
    });

    process.on('SIGINT', async () => {
        logger.info('Webhook relay shutting down (SIGINT)');
        await dbPool?.end();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.info('Webhook relay shutting down (SIGTERM)');
        await dbPool?.end();
        process.exit(0);
    });

    while (true) {
        try {
            const lastBlock = await getLastBlock(db, deployBlock);
            const latest    = await provider.getBlockNumber();

            if (latest > lastBlock) {
                // Chunk the range so we never exceed the RPC block-range limit.
                let from = lastBlock + 1;
                while (from <= latest) {
                    const to = Math.min(from + MAX_BLOCK_RANGE - 1, latest);
                    await processRange(provider, db, requireEnv('CONTRACT_ADDRESS'), from, to);
                    from = to + 1;
                }
                await setLastBlock(db, latest);
                logger.info('Poll complete', { processedUpTo: latest });
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('Poll tick failed', { error: message });
        }

        await sleep(intervalMs + jitter(intervalMs));
    }
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Webhook relay failed to start', { error: message });
    process.exit(1);
});
