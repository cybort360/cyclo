/**
 * Deploys SubscriptionNFT only and wires it to the already-deployed SubscriptionManager.
 * Run this when CONTRACT_ADDRESS is already set but SUBSCRIPTION_NFT_ADDRESS is missing.
 *
 * Steps:
 *   1. Deploy SubscriptionNFT("Cyclo Subscription", "CYCLO-SUB")
 *   2. Transfer NFT ownership to SubscriptionManager
 *   3. Call SubscriptionManager.setSubscriptionNFT(nftAddress)
 *   4. Write SUBSCRIPTION_NFT_ADDRESS to .env
 *
 * Usage: tsx scripts/deployNFT.ts
 * Required env vars: ARC_RPC_URL, CONTRACT_ADDRESS, DEPLOYER_PRIVATE_KEY
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { Contract, ContractFactory, InterfaceAbi, JsonRpcProvider, Wallet } from 'ethers';

interface ForgeArtifact {
    abi:      InterfaceAbi;
    bytecode: { object: string };
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

function loadArtifact(contractName: string): ForgeArtifact {
    const artifactPath = path.resolve(`out/${contractName}.sol/${contractName}.json`);
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`Forge artifact not found at ${artifactPath}. Run \`forge build\` first.`);
    }
    return JSON.parse(fs.readFileSync(artifactPath, 'utf-8')) as ForgeArtifact;
}

function writeEnvValue(key: string, value: string): void {
    const envPath = path.resolve('.env');
    const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    const pattern = new RegExp(`^${key}=.*`, 'm');
    const line    = `${key}=${value}`;
    const updated = pattern.test(current)
        ? current.replace(pattern, line)
        : `${current.trimEnd()}\n${line}\n`;
    fs.writeFileSync(envPath, updated);
}

async function main(): Promise<void> {
    const arcRpcUrl      = requireEnv('ARC_RPC_URL');
    const managerAddress = requireEnv('CONTRACT_ADDRESS');
    const deployerKey    = requireEnv('DEPLOYER_PRIVATE_KEY');

    const nftArtifact     = loadArtifact('SubscriptionNFT');
    const managerArtifact = loadArtifact('SubscriptionManager');

    const provider = new JsonRpcProvider(arcRpcUrl);
    const signer   = new Wallet(deployerKey, provider);

    console.log(`Deployer:           ${signer.address}`);
    console.log(`SubscriptionManager: ${managerAddress}`);

    // ── Step 1: Deploy SubscriptionNFT ────────────────────────────────────────

    console.log('\nDeploying SubscriptionNFT...');
    const nftFactory  = new ContractFactory(nftArtifact.abi, nftArtifact.bytecode.object, signer);
    const nftContract = await nftFactory.deploy('Cyclo Subscription', 'CYCLO-SUB');
    const nftReceipt  = await nftContract.deploymentTransaction()?.wait();
    const nftAddress  = await nftContract.getAddress();

    console.log(`SubscriptionNFT:    ${nftAddress}`);
    console.log(`Tx hash:            ${nftReceipt?.hash ?? 'unknown'}`);
    console.log(`Block:              ${nftReceipt?.blockNumber ?? 'unknown'}`);
    console.log(`Explorer:           https://testnet.arcscan.app/address/${nftAddress}`);

    // ── Step 2: Transfer NFT ownership to SubscriptionManager ─────────────────

    console.log('\nTransferring NFT ownership to SubscriptionManager...');
    const nft        = new Contract(nftAddress, nftArtifact.abi, signer);
    const transferTx = await nft.transferOwnership(managerAddress) as { hash: string; wait: () => Promise<unknown> };
    await transferTx.wait();
    console.log(`Ownership transferred (tx: ${transferTx.hash})`);

    // ── Step 3: Register NFT with SubscriptionManager ─────────────────────────

    console.log('\nRegistering NFT with SubscriptionManager...');
    const manager  = new Contract(managerAddress, managerArtifact.abi, signer);
    const setNftTx = await manager.setSubscriptionNFT(nftAddress) as { hash: string; wait: () => Promise<unknown> };
    await setNftTx.wait();
    console.log(`setSubscriptionNFT called (tx: ${setNftTx.hash})`);

    // ── Step 4: Persist address to .env ───────────────────────────────────────

    writeEnvValue('SUBSCRIPTION_NFT_ADDRESS', nftAddress);
    console.log('\nSUBSCRIPTION_NFT_ADDRESS written to .env');
    console.log('Done.');
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`deployNFT failed: ${message}`);
    process.exit(1);
});
