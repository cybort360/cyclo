/**
 * Webhook relay entry point.
 * Validates env, then starts the block-by-block event relay loop.
 *
 * Usage:
 *   npm run webhook
 *
 * Required env vars:
 *   ARC_RPC_URL, CONTRACT_ADDRESS
 *
 * Optional env vars:
 *   WEBHOOK_POLL_INTERVAL_MS (default: 10000)
 */
import { logger } from '../keeper/logger.js';
import { startRelay } from './relay.js';

const REQUIRED = ['ARC_RPC_URL', 'CONTRACT_ADDRESS'] as const;

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`Missing required environment variable: ${key}`);
    return value;
}

const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing });
    process.exit(1);
}

const pollIntervalMs = parseInt(process.env.WEBHOOK_POLL_INTERVAL_MS ?? '10000', 10);
if (isNaN(pollIntervalMs) || pollIntervalMs <= 0) {
    logger.error('WEBHOOK_POLL_INTERVAL_MS must be a positive integer');
    process.exit(1);
}

process.on('SIGINT',  () => { logger.info('webhook relay shutting down'); process.exit(0); });
process.on('SIGTERM', () => { logger.info('webhook relay shutting down'); process.exit(0); });

startRelay({
    rpcUrl:          requireEnv('ARC_RPC_URL'),
    contractAddress: requireEnv('CONTRACT_ADDRESS'),
    pollIntervalMs,
}).catch(err => {
    logger.error('webhook relay crashed', { error: String(err) });
    process.exit(1);
});
