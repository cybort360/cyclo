/**
 * Webhook relay — polls the chain for new events block-by-block and delivers
 * them as HTTP POST requests to registered endpoints. Mirrors keeper/scheduler.ts
 * patterns: jitter, structured logging, graceful per-delivery error handling.
 */
import { createHmac, randomBytes } from 'crypto';
import { Contract, JsonRpcProvider } from 'ethers';
import { logger } from '../keeper/logger.js';
import { SUBSCRIPTION_MANAGER_ABI } from '../src/constants/abis.js';
import { loadRegistry, matchingEntries, type WebhookEntry } from './registry.js';

const EVENT_NAMES = [
    'PlanCreated',
    'PlanDeactivated',
    'SubscriptionCreated',
    'SubscriptionCancelled',
    'PaymentCharged',
    'PlanMigrated',
] as const;

type EventName = typeof EVENT_NAMES[number];

const EVENT_TYPE_MAP: Record<EventName, string> = {
    PlanCreated:          'plan.created',
    PlanDeactivated:      'plan.deactivated',
    SubscriptionCreated:  'subscription.created',
    SubscriptionCancelled:'subscription.cancelled',
    PaymentCharged:       'payment.charged',
    PlanMigrated:         'plan.migrated',
};

export interface RelayEnv {
    rpcUrl:           string;
    contractAddress:  string;
    pollIntervalMs:   number;
}

function jitter(baseMs: number): number {
    return Math.floor(Math.random() * 0.2 * baseMs);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function eventId(): string {
    return 'evt_' + randomBytes(8).toString('hex');
}

function sign(payload: string, secret: string): string {
    return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
}

/** Delivers one webhook payload to one endpoint with up to 3 retries. */
async function deliver(entry: WebhookEntry, eventType: string, data: Record<string, string>): Promise<void> {
    const body = JSON.stringify({
        id:        eventId(),
        event:     eventType,
        timestamp: new Date().toISOString(),
        data,
    });

    const headers: Record<string, string> = {
        'Content-Type':  'application/json',
        'X-Cyclo-Event': eventType,
    };
    if (entry.secret) headers['X-Cyclo-Signature'] = sign(body, entry.secret);

    const delays = [1000, 2000, 4000];
    for (let attempt = 0; attempt <= 2; attempt++) {
        try {
            const res = await fetch(entry.url, { method: 'POST', headers, body });
            if (res.ok) {
                logger.info('webhook delivered', { url: entry.url, event: eventType, status: res.status });
                return;
            }
            logger.warn('webhook non-2xx', { url: entry.url, event: eventType, status: res.status, attempt });
        } catch (err) {
            logger.warn('webhook delivery error', { url: entry.url, event: eventType, attempt, error: String(err) });
        }
        if (attempt < 2) await sleep(delays[attempt]);
    }
    logger.error('webhook delivery failed after retries', { url: entry.url, event: eventType });
}

/** Extracts a flat string record from a parsed ethers log's args for the webhook payload. */
function extractData(eventName: EventName, args: Record<string, unknown>): Record<string, string> {
    const str = (v: unknown): string => (typeof v === 'bigint' ? v.toString() : String(v ?? ''));
    switch (eventName) {
        case 'PlanCreated':
            return { planId: str(args.planId), merchant: str(args.merchant), price: str(args.price), interval: str(args.interval) };
        case 'PlanDeactivated':
            return { planId: str(args.planId), merchant: str(args.merchant) };
        case 'SubscriptionCreated':
            return { planId: str(args.planId), subscriber: str(args.subscriber), nextChargeTimestamp: str(args.nextChargeTimestamp) };
        case 'SubscriptionCancelled':
            return { planId: str(args.planId), subscriber: str(args.subscriber) };
        case 'PaymentCharged':
            return { planId: str(args.planId), subscriber: str(args.subscriber), merchant: str(args.merchant), amount: str(args.amount), nextChargeTimestamp: str(args.nextChargeTimestamp) };
        case 'PlanMigrated':
            return { fromPlanId: str(args.fromPlanId), toPlanId: str(args.toPlanId), subscriber: str(args.subscriber) };
        default:
            return {};
    }
}

export async function startRelay(env: RelayEnv): Promise<void> {
    const provider = new JsonRpcProvider(env.rpcUrl);
    const contract = new Contract(env.contractAddress, SUBSCRIPTION_MANAGER_ABI, provider);

    let lastBlock = (await provider.getBlockNumber()) - 1;
    logger.info('webhook relay started', { contractAddress: env.contractAddress, startBlock: lastBlock });

    while (true) {
        try {
            const currentBlock = await provider.getBlockNumber();
            if (currentBlock > lastBlock) {
                const registry = loadRegistry();
                for (const eventName of EVENT_NAMES) {
                    const logs = await contract.queryFilter(eventName, lastBlock + 1, currentBlock);
                    for (const log of logs) {
                        if (!('args' in log)) continue;
                        const args    = log.args as Record<string, unknown>;
                        const planId  = typeof args.planId === 'bigint' ? args.planId
                                      : typeof args.fromPlanId === 'bigint' ? args.fromPlanId
                                      : 0n;
                        const entries = matchingEntries(planId, registry);
                        if (entries.length === 0) continue;
                        const eventType = EVENT_TYPE_MAP[eventName];
                        const data      = extractData(eventName, args);
                        await Promise.all(entries.map(entry => deliver(entry, eventType, data)));
                    }
                }
                lastBlock = currentBlock;
            }
        } catch (err) {
            logger.error('relay poll error', { error: String(err) });
        }
        await sleep(env.pollIntervalMs + jitter(env.pollIntervalMs));
    }
}
