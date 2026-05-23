/**
 * Deploys SubscriptionManager and SubscriptionNFT to Arc testnet, then wires them together.
 * Reads compiled artifacts from Foundry's out/ directory.
 *
 * Deployment order:
 *   1. Deploy SubscriptionManager
 *   2. Deploy SubscriptionNFT("Cyclo Subscription", "CYCLO-SUB") — deployer is initial owner
 *   3. Transfer NFT ownership to SubscriptionManager (nft.transferOwnership)
 *   4. Register NFT with SubscriptionManager (manager.setSubscriptionNFT)
 *   5. Write CONTRACT_ADDRESS and SUBSCRIPTION_NFT_ADDRESS to .env
 *
 * Usage: ts-node scripts/deploy.ts
 * Required env vars: ARC_RPC_URL, USDC_ADDRESS, DEPLOYER_PRIVATE_KEY, FEE_RECIPIENT
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { Contract, ContractFactory, InterfaceAbi, JsonRpcProvider, Wallet } from 'ethers';

interface ForgeArtifact {
    abi: InterfaceAbi;
    bytecode: { object: string };
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

/**
 * Loads a Foundry-compiled artifact from the out/ directory.
 * @param contractName Bare contract name matching the Solidity filename (e.g. "SubscriptionManager")
 */
function loadArtifact(contractName: string): ForgeArtifact {
    const artifactPath = path.resolve(`out/${contractName}.sol/${contractName}.json`);
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`Forge artifact not found at ${artifactPath}. Run \`forge build\` first.`);
    }
    return JSON.parse(fs.readFileSync(artifactPath, 'utf-8')) as ForgeArtifact;
}

/**
 * Upserts a single key=value line in .env.
 * Creates the file if it does not exist. Replaces the line in place if the key already exists.
 */
function writeEnvValue(key: string, value: string): void {
    const envPath  = path.resolve('.env');
    const current  = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    const pattern  = new RegExp(`^${key}=.*`, 'm');
    const line     = `${key}=${value}`;
    const updated  = pattern.test(current)
        ? current.replace(pattern, line)
        : `${current.trimEnd()}\n${line}\n`;
    fs.writeFileSync(envPath, updated);
}

async function main(): Promise<void> {
    const arcRpcUrl    = requireEnv('ARC_RPC_URL');
    const usdcAddress  = requireEnv('USDC_ADDRESS');
    const deployerKey  = requireEnv('DEPLOYER_PRIVATE_KEY');
    const feeRecipient = requireEnv('FEE_RECIPIENT');

    const managerArtifact = loadArtifact('SubscriptionManager');
    const nftArtifact     = loadArtifact('SubscriptionNFT');

    const provider     = new JsonRpcProvider(arcRpcUrl);
    const signerWallet = new Wallet(deployerKey, provider);

    console.log(`Deployer address: ${signerWallet.address}`);
    console.log(`USDC address:     ${usdcAddress}`);
    console.log(`Fee recipient:    ${feeRecipient}`);

    // ── Step 1: Deploy SubscriptionManager ────────────────────────────────────

    console.log('\nDeploying SubscriptionManager...');
    const managerFactory  = new ContractFactory(managerArtifact.abi, managerArtifact.bytecode.object, signerWallet);
    const managerContract = await managerFactory.deploy(usdcAddress, feeRecipient);
    const managerReceipt  = await managerContract.deploymentTransaction()?.wait();
    const managerAddress  = await managerContract.getAddress();

    console.log(`SubscriptionManager: ${managerAddress}`);
    console.log(`Tx hash:             ${managerReceipt?.hash ?? 'unknown'}`);
    console.log(`Block:               ${managerReceipt?.blockNumber ?? 'unknown'}`);
    console.log(`Explorer:            https://testnet.arcscan.app/address/${managerAddress}`);

    // ── Step 2: Deploy SubscriptionNFT (deployer is initial owner) ────────────

    console.log('\nDeploying SubscriptionNFT...');
    const nftFactory  = new ContractFactory(nftArtifact.abi, nftArtifact.bytecode.object, signerWallet);
    const nftContract = await nftFactory.deploy('Cyclo Subscription', 'CYCLO-SUB');
    const nftReceipt  = await nftContract.deploymentTransaction()?.wait();
    const nftAddress  = await nftContract.getAddress();

    console.log(`SubscriptionNFT:     ${nftAddress}`);
    console.log(`Tx hash:             ${nftReceipt?.hash ?? 'unknown'}`);
    console.log(`Block:               ${nftReceipt?.blockNumber ?? 'unknown'}`);
    console.log(`Explorer:            https://testnet.arcscan.app/address/${nftAddress}`);

    // ── Step 3: Transfer NFT ownership to SubscriptionManager ─────────────────

    console.log('\nTransferring NFT ownership to SubscriptionManager...');
    const nft        = new Contract(nftAddress, nftArtifact.abi, signerWallet);
    const transferTx = await nft.transferOwnership(managerAddress) as { hash: string; wait: () => Promise<unknown> };
    await transferTx.wait();
    console.log(`Ownership transferred (tx: ${transferTx.hash})`);

    // ── Step 4: Register NFT with SubscriptionManager ─────────────────────────

    console.log('\nRegistering NFT with SubscriptionManager...');
    const manager  = new Contract(managerAddress, managerArtifact.abi, signerWallet);
    const setNftTx = await manager.setSubscriptionNFT(nftAddress) as { hash: string; wait: () => Promise<unknown> };
    await setNftTx.wait();
    console.log(`setSubscriptionNFT called (tx: ${setNftTx.hash})`);

    // ── Step 5: Persist addresses to .env ─────────────────────────────────────

    writeEnvValue('CONTRACT_ADDRESS', managerAddress);
    writeEnvValue('SUBSCRIPTION_NFT_ADDRESS', nftAddress);
    console.log('\nCONTRACT_ADDRESS written to .env');
    console.log('SUBSCRIPTION_NFT_ADDRESS written to .env');
    console.log('\nDeployment complete.');
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Deploy failed: ${message}`);
    process.exit(1);
});
