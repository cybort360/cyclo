/**
 * wagmi configuration for Arc testnet.
 *
 * RPC URL is read from VITE_ARC_RPC_URL so the same build works in both
 * local dev and production (Vercel). The Vite dev server proxy for /rpc is
 * kept in vite.config.ts for local development only — it is not used here.
 */
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { defineChain } from 'viem';

const ARC_RPC_URL =
    (import.meta.env.VITE_ARC_RPC_URL as string | undefined) ?? ''


export const arcTestnet = defineChain({
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
    rpcUrls: {
        default: { http: [ARC_RPC_URL] },
    },
    blockExplorers: {
        default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
    },
});

export const wagmiConfig = createConfig({
    chains:     [arcTestnet],
    connectors: [injected()],
    transports: {
        [arcTestnet.id]: http(ARC_RPC_URL),
    },
});
