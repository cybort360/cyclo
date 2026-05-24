/**
 * CLI for managing webhook endpoint registrations.
 *
 * Usage:
 *   tsx webhook/register.ts add <planId|*> <url> [--secret <s>]
 *   tsx webhook/register.ts list
 *   tsx webhook/register.ts remove <planId|*> <url>
 *
 * Examples:
 *   tsx webhook/register.ts add 7 https://api.myapp.com/hook --secret whsec_abc123
 *   tsx webhook/register.ts add "*" https://api.myapp.com/all-events
 *   tsx webhook/register.ts list
 *   tsx webhook/register.ts remove 7 https://api.myapp.com/hook
 */
import { addEntry, removeEntry, loadRegistry } from './registry.js';

const [,, command, ...rest] = process.argv;

function printUsage(): void {
    console.log('Usage:');
    console.log('  tsx webhook/register.ts add <planId|*> <url> [--secret <s>]');
    console.log('  tsx webhook/register.ts list');
    console.log('  tsx webhook/register.ts remove <planId|*> <url>');
}

switch (command) {
    case 'add': {
        const planId = rest[0];
        const url    = rest[1];
        if (!planId || !url) { printUsage(); process.exit(1); }

        const secretIdx = rest.indexOf('--secret');
        const secret    = secretIdx !== -1 ? (rest[secretIdx + 1] ?? null) : null;

        addEntry({ planId, url, secret });
        console.log(`Registered: planId=${planId} url=${url} secret=${secret ? '[set]' : 'none'}`);
        break;
    }

    case 'remove': {
        const planId = rest[0];
        const url    = rest[1];
        if (!planId || !url) { printUsage(); process.exit(1); }

        const removed = removeEntry(planId, url);
        console.log(removed ? `Removed: planId=${planId} url=${url}` : 'No matching entry found.');
        break;
    }

    case 'list': {
        const entries = loadRegistry();
        if (entries.length === 0) {
            console.log('No webhook endpoints registered.');
        } else {
            console.log(`${entries.length} endpoint(s):`);
            entries.forEach(e =>
                console.log(`  planId=${e.planId}  url=${e.url}  secret=${e.secret ? '[set]' : 'none'}`)
            );
        }
        break;
    }

    default:
        printUsage();
        process.exit(1);
}
