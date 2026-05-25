/**
 * wagmi configuration for Arc testnet.
 *
 * All RPC traffic is sent to /rpc — a relative path that works in both
 * environments without CORS issues:
 *   • Local dev  — Vite dev server proxies /rpc → VITE_ARC_RPC_URL (vite.config.ts)
 *   • Production — Vercel rewrites /rpc → Arc RPC endpoint   (vercel.json)
 *
 * Never call the Arc RPC URL directly from the browser — the endpoint does
 * not emit CORS headers and requests will be blocked.
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
    // Arc Testnet does not have the Multicall3 contract deployed at the
    // standard address. Disabling multicall batching globally causes wagmi
    // and viem to fall back to individual eth_call requests instead.
    batch: { multicall: false },
});
