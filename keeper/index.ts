/**
 * Keeper bot entry point.
 * Validates all required environment variables at startup, connects to Arc
 * testnet, loads the keeper wallet, and starts the charge() polling loop.
 *
 * Required environment variables (see .env.example):
 *   ARC_RPC_URL, CONTRACT_ADDRESS, KEEPER_PRIVATE_KEY, KEEPER_POLL_INTERVAL_MS
 */

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { logger } from './logger.js';
import { Scheduler } from './scheduler.js';
import { NonceManager } from './nonce.js';
import { closePool } from './db/client.js';
import { ReorgDetector } from './reorg.js';
import { ExecutorPool } from './executor.js';

dotenv.config();

const artifact = JSON.parse(
    readFileSync(
        join(process.cwd(), 'out/SubscriptionManager.sol/SubscriptionManager.json'),
        'utf-8'
    )
);
const abi = artifact.abi;

const REQUIRED_ENV_VARS = [
    'ARC_RPC_URL',
    'CONTRACT_ADDRESS',
    'KEEPER_PRIVATE_KEY',
    'KEEPER_POLL_INTERVAL_MS',
    'DATABASE_URL',
    'DEPLOY_BLOCK',
] as const;

/** Returns all required env vars or throws a single descriptive error. */
function validateEnv(): Record<string, string> {
    const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    return Object.fromEntries(
        REQUIRED_ENV_VARS.map((key) => [key, process.env[key] as string])
    );
}

function jitter(baseMs: number): number {
    return Math.floor(Math.random() * 0.2 * baseMs);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
    const env = validateEnv();

    const intervalMs = parseInt(env.KEEPER_POLL_INTERVAL_MS, 10);
    if (isNaN(intervalMs) || intervalMs <= 0) {
        throw new Error(`KEEPER_POLL_INTERVAL_MS must be a positive integer, got: "${env.KEEPER_POLL_INTERVAL_MS}"`);
    }

    const provider      = new JsonRpcProvider(env.ARC_RPC_URL);
    const signer        = new Wallet(env.KEEPER_PRIVATE_KEY, provider);
    const contract      = new Contract(env.CONTRACT_ADDRESS, abi, signer);
    const nonceManager   = new NonceManager(signer, provider);
    await nonceManager.init();
    const deployBlock    = parseInt(env.DEPLOY_BLOCK, 10);
    if (isNaN(deployBlock) || deployBlock < 0) {
        throw new Error(`DEPLOY_BLOCK must be a non-negative integer, got: "${env.DEPLOY_BLOCK}"`);
    }
    const reorgDetector  = new ReorgDetector(provider);
    const executor       = new ExecutorPool(contract, nonceManager);
    const scheduler      = new Scheduler(contract, signer, provider, nonceManager, reorgDetector, executor, deployBlock);

    logger.info('Keeper starting', {
        contractAddress: env.CONTRACT_ADDRESS,
        keeperAddress:   signer.address,
        pollIntervalMs:  intervalMs,
    });

    process.on('SIGINT', async () => {
        logger.info('Keeper shutting down (SIGINT)');
        await closePool();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.info('Keeper shutting down (SIGTERM)');
        await closePool();
        process.exit(0);
    });

    while (true) {
        try {
            await scheduler.syncEvents();
            await scheduler.processDueCharges();
            await scheduler.processGracePeriod();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('Poll tick failed', { error: message });
        }
        await sleep(intervalMs + jitter(intervalMs));
    }
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Keeper failed to start', { error: message });
    process.exit(1);
});
