/**
 * Approves USDC spending and subscribes a wallet to a plan.
 * Sends two transactions: USDC.approve then SubscriptionManager.subscribe.
 *
 * Usage: ts-node scripts/subscribe.ts <planId>
 *   planId — numeric plan ID from createPlan output
 *
 * Required env vars: ARC_RPC_URL, CONTRACT_ADDRESS, USDC_ADDRESS, DEPLOYER_PRIVATE_KEY
 */

import dotenv from 'dotenv';
dotenv.config();

import { Contract, Interface, JsonRpcProvider, MaxUint256, Wallet } from 'ethers';
import { SUBSCRIPTION_MANAGER_ABI, USDC_ABI } from '../src/constants/abis';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

async function main(): Promise<void> {
    const [planIdArg] = process.argv.slice(2);
    if (!planIdArg) {
        throw new Error('Usage: ts-node scripts/subscribe.ts <planId>');
    }

    const planId = BigInt(planIdArg);

    const arcRpcUrl       = requireEnv('ARC_RPC_URL');
    const contractAddress = requireEnv('CONTRACT_ADDRESS');
    const usdcAddress     = requireEnv('USDC_ADDRESS');
    const deployerKey     = requireEnv('DEPLOYER_PRIVATE_KEY');

    const provider     = new JsonRpcProvider(arcRpcUrl);
    const signerWallet = new Wallet(deployerKey, provider);
    const usdcContract = new Contract(usdcAddress, USDC_ABI, signerWallet);
    const subContract  = new Contract(contractAddress, SUBSCRIPTION_MANAGER_ABI, signerWallet);

    console.log(`Subscriber:  ${signerWallet.address}`);
    console.log(`Plan ID:     ${planId}`);

    console.log('Approving USDC (MaxUint256)...');
    const approveTx      = await usdcContract.getFunction('approve')(contractAddress, MaxUint256);
    const approveReceipt = await approveTx.wait();
    if (!approveReceipt) throw new Error('Approve transaction receipt not received');
    console.log(`  Approve tx hash: ${approveReceipt.hash}`);

    console.log('Subscribing to plan...');
    const subscribeTx      = await subContract.getFunction('subscribe')(planId);
    const subscribeReceipt = await subscribeTx.wait();
    if (!subscribeReceipt) throw new Error('Subscribe transaction receipt not received');

    const iface = new Interface(SUBSCRIPTION_MANAGER_ABI);
    let nextChargeTimestamp: bigint | undefined;
    for (const log of subscribeReceipt.logs) {
        try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === 'SubscriptionCreated') {
                nextChargeTimestamp = parsed.args[2] as bigint;
                break;
            }
        } catch {
            // skip logs emitted by other contracts
        }
    }

    console.log('Subscribed successfully');
    console.log(`  Subscribe tx hash: ${subscribeReceipt.hash}`);
    if (nextChargeTimestamp !== undefined) {
        const nextChargeDate = new Date(Number(nextChargeTimestamp) * 1000).toISOString();
        console.log(`  First charge due:  ${nextChargeDate}`);
    }
    console.log(`  Explorer: https://testnet.arcscan.app/tx/${subscribeReceipt.hash}`);
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`subscribe failed: ${message}`);
    process.exit(1);
});
