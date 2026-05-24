/**
 * Creates a subscription plan on SubscriptionManager.
 * Parses PlanCreated to log the resulting planId.
 *
 * Usage: tsx scripts/createPlan.ts <priceUsdc> <intervalSeconds> [trialDays]
 *   priceUsdc       — human-readable USDC amount, e.g. "9.99" or "10"
 *   intervalSeconds — billing interval in seconds, e.g. "2592000" for 30 days
 *   trialDays       — optional free-trial period in days, e.g. "7" (default: 0)
 *
 * Required env vars: ARC_RPC_URL, CONTRACT_ADDRESS, DEPLOYER_PRIVATE_KEY
 */

import dotenv from 'dotenv';
dotenv.config();

import { Contract, Interface, JsonRpcProvider, Wallet } from 'ethers';
import { SUBSCRIPTION_MANAGER_ABI } from '../src/constants/abis';
import { toUsdcUnits } from '../src/utils/formatting';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

async function main(): Promise<void> {
    const [priceArg, intervalArg, trialDaysArg] = process.argv.slice(2);
    if (!priceArg || !intervalArg) {
        throw new Error('Usage: tsx scripts/createPlan.ts <priceUsdc> <intervalSeconds> [trialDays]');
    }

    const intervalSeconds = parseInt(intervalArg, 10);
    if (isNaN(intervalSeconds) || intervalSeconds <= 0) {
        throw new Error(`intervalSeconds must be a positive integer, got: "${intervalArg}"`);
    }

    const trialDays = trialDaysArg ? parseFloat(trialDaysArg) : 0;
    if (isNaN(trialDays) || trialDays < 0) {
        throw new Error(`trialDays must be a non-negative number, got: "${trialDaysArg}"`);
    }
    const trialDuration = BigInt(Math.round(trialDays * 86400));

    const arcRpcUrl       = requireEnv('ARC_RPC_URL');
    const contractAddress = requireEnv('CONTRACT_ADDRESS');
    const deployerKey     = requireEnv('DEPLOYER_PRIVATE_KEY');

    const priceRaw = toUsdcUnits(priceArg);
    if (priceRaw === 0n) {
        throw new Error('price must be greater than zero');
    }

    const provider     = new JsonRpcProvider(arcRpcUrl);
    const signerWallet = new Wallet(deployerKey, provider);
    const contract     = new Contract(contractAddress, SUBSCRIPTION_MANAGER_ABI, signerWallet);

    console.log(`Creating plan: price=${priceArg} USDC (${priceRaw} raw), interval=${intervalSeconds}s, trial=${trialDays}d (${trialDuration}s)`);

    const tx      = await contract.getFunction('createPlan')(priceRaw, BigInt(intervalSeconds), trialDuration);
    const receipt = await tx.wait();
    if (!receipt) throw new Error('Transaction receipt not received');

    const iface = new Interface(SUBSCRIPTION_MANAGER_ABI);
    let planId: bigint | undefined;
    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === 'PlanCreated') {
                planId = parsed.args[0] as bigint;
                break;
            }
        } catch {
            // skip logs emitted by other contracts
        }
    }

    if (planId === undefined) throw new Error('PlanCreated event not found in receipt');

    console.log('Plan created successfully');
    console.log(`  Plan ID:  ${planId}`);
    console.log(`  Tx hash:  ${receipt.hash}`);
    console.log(`  Explorer: https://testnet.arcscan.app/tx/${receipt.hash}`);
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`createPlan failed: ${message}`);
    process.exit(1);
});
