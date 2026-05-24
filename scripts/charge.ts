/**
 * Manually triggers charge() for a single subscription.
 * For one-off testing — the keeper bot automates this in production.
 *
 * Usage: ts-node scripts/charge.ts <planId> <subscriberAddress>
 *   planId            — numeric plan ID
 *   subscriberAddress — wallet address of the subscriber
 *
 * Required env vars: ARC_RPC_URL, CONTRACT_ADDRESS, DEPLOYER_PRIVATE_KEY
 */

import dotenv from 'dotenv';
dotenv.config();

import { Contract, Interface, JsonRpcProvider, Wallet } from 'ethers';
import { SUBSCRIPTION_MANAGER_ABI } from '../src/constants/abis';
import { fromUsdcUnits } from '../src/utils/formatting';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

async function main(): Promise<void> {
    const [planIdArg, subscriberArg] = process.argv.slice(2);
    if (!planIdArg || !subscriberArg) {
        throw new Error('Usage: ts-node scripts/charge.ts <planId> <subscriberAddress>');
    }

    const planId = BigInt(planIdArg);

    const arcRpcUrl       = requireEnv('ARC_RPC_URL');
    const contractAddress = requireEnv('CONTRACT_ADDRESS');
    const deployerKey     = requireEnv('DEPLOYER_PRIVATE_KEY');

    const provider     = new JsonRpcProvider(arcRpcUrl);
    const signerWallet = new Wallet(deployerKey, provider);
    const contract     = new Contract(contractAddress, SUBSCRIPTION_MANAGER_ABI, signerWallet);

    console.log(`Charging plan ${planId} for subscriber ${subscriberArg}...`);

    const tx      = await contract.getFunction('charge')(planId, subscriberArg);
    const receipt = await tx.wait();
    if (!receipt) throw new Error('Transaction receipt not received');

    const iface = new Interface(SUBSCRIPTION_MANAGER_ABI);
    let amount: bigint | undefined;
    let nextChargeTimestamp: bigint | undefined;
    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === 'PaymentCharged') {
                amount              = parsed.args[3] as bigint;
                nextChargeTimestamp = parsed.args[4] as bigint;
                break;
            }
        } catch {
            // skip logs emitted by other contracts
        }
    }

    console.log('Charge successful');
    console.log(`  Tx hash:  ${receipt.hash}`);
    if (amount !== undefined) {
        console.log(`  Amount:   ${fromUsdcUnits(amount)} USDC`);
    }
    if (nextChargeTimestamp !== undefined) {
        const nextChargeDate = new Date(Number(nextChargeTimestamp) * 1000).toISOString();
        console.log(`  Next charge due: ${nextChargeDate}`);
    }
    console.log(`  Explorer: https://testnet.arcscan.app/tx/${receipt.hash}`);
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`charge failed: ${message}`);
    process.exit(1);
});
