/**
 * Webhook registry — persists endpoint registrations to webhooks.json.
 * Each entry maps a planId (or "*" for all plans) to a delivery URL and optional HMAC secret.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const REGISTRY_PATH = resolve(import.meta.dirname, 'webhooks.json');

export interface WebhookEntry {
    planId: string; // numeric planId or "*" for all events
    url:    string;
    secret: string | null;
}

export function loadRegistry(): WebhookEntry[] {
    if (!existsSync(REGISTRY_PATH)) return [];
    try {
        return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as WebhookEntry[];
    } catch {
        return [];
    }
}

export function saveRegistry(entries: WebhookEntry[]): void {
    writeFileSync(REGISTRY_PATH, JSON.stringify(entries, null, 2), 'utf8');
}

export function addEntry(entry: WebhookEntry): void {
    const entries = loadRegistry();
    const exists  = entries.some(e => e.planId === entry.planId && e.url === entry.url);
    if (!exists) {
        entries.push(entry);
        saveRegistry(entries);
    }
}

export function removeEntry(planId: string, url: string): boolean {
    const entries = loadRegistry();
    const next    = entries.filter(e => !(e.planId === planId && e.url === url));
    if (next.length === entries.length) return false;
    saveRegistry(next);
    return true;
}

/** Returns all registry entries that match a given numeric planId. */
export function matchingEntries(planId: bigint, registry: WebhookEntry[]): WebhookEntry[] {
    const id = planId.toString();
    return registry.filter(e => e.planId === '*' || e.planId === id);
}
