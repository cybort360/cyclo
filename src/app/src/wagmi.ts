/**
 * wagmi configuration for Arc testnet.
 * RPC calls are proxied through /rpc by the Vite dev server to avoid CORS.
 */
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { defineChain } from 'viem';

export const arcTestnet = defineChain({
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
    rpcUrls: {
        default: { http: ['/rpc'] },
    },
    blockExplorers: {
        default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
    },
});

export const wagmiConfig = createConfig({
    chains:     [arcTestnet],
    connectors: [injected()],
    transports: {
        [arcTestnet.id]: http('/rpc'),
    },
});
