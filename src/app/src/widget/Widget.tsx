/**
 * Self-contained checkout widget — brings its own WagmiProvider and QueryClientProvider
 * so it can be embedded in any React app or plain HTML page without conflicting with
 * the host application's wagmi configuration.
 *
 * Exports:
 *   CycloCheckout        — renders the checkout card inline into any container.
 *   CycloFloatingButton  — renders a fixed trigger button that opens the checkout
 *                          card in a modal overlay when clicked.
 */

// ── Inlined SVG constants ─────────────────────────────────────────────────────
// White variant of the Cyclo arc logo used in the floating trigger button.
// This is a compile-time string constant with no user-supplied data and no
// runtime interpolation. It is injected via dangerouslySetInnerHTML solely to
// keep the IIFE bundle dependency-free (no SVG imports, no component refs).
// XSS is not possible: the string never changes after build.

const LOGO_SVG_WHITE = `<svg width="22" height="22" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M394 122C355 84 307 64 256 64C149 64 64 149 64 256C64 363 149 448 256 448C307 448 355 428 394 390" stroke="white" stroke-width="48" stroke-linecap="round" fill="none"/></svg>`

import { useRef, useState } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { defineChain } from 'viem';
import { injected } from 'wagmi/connectors';
import { CheckoutCard } from './CheckoutCard';

export const arcTestnet = defineChain({
    id:             5042002,
    name:           'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
    rpcUrls:        { default: { http: ['https://placeholder.rpc'] } },
    blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
});

export interface WidgetOptions {
    planId:          bigint;
    contractAddress: string;
    usdcAddress:     string;
    /** Direct RPC URL. Defaults to '/rpc' (Vite proxy) for same-origin dev use. */
    rpcUrl?:         string;
}

export function CycloCheckout({ planId, contractAddress, usdcAddress, rpcUrl = '/rpc' }: WidgetOptions) {
    const configRef = useRef<ReturnType<typeof createConfig> | undefined>(undefined);
    if (!configRef.current) {
        configRef.current = createConfig({
            chains:     [arcTestnet],
            connectors: [injected()],
            transports: { [arcTestnet.id]: http(rpcUrl) },
        });
    }

    const queryClientRef = useRef<QueryClient | undefined>(undefined);
    if (!queryClientRef.current) {
        queryClientRef.current = new QueryClient();
    }

    return (
        <WagmiProvider config={configRef.current}>
            <QueryClientProvider client={queryClientRef.current}>
                <CheckoutCard
                    planId={planId}
                    contractAddress={contractAddress}
                    usdcAddress={usdcAddress}
                />
            </QueryClientProvider>
        </WagmiProvider>
    );
}

// ── Floating trigger button + modal ───────────────────────────────────────────

/** 48 px indigo circle button that holds the white Cyclo logo. */
function TriggerButton({ onClick }: { onClick: () => void }) {
    const [hovered, setHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            aria-label="Open Cyclo checkout"
            style={{
                width:        '48px',
                height:       '48px',
                borderRadius: '50%',
                background:   hovered ? '#4338CA' : '#4F46E5',
                border:       'none',
                cursor:       'pointer',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                padding:      0,
                boxShadow:    hovered
                    ? '0 6px 24px rgba(79,70,229,0.45)'
                    : '0 4px 16px rgba(79,70,229,0.35)',
                transform:    hovered ? 'scale(1.05)' : 'scale(1)',
                transition:   'background 150ms ease, box-shadow 150ms ease, transform 150ms ease',
            }}
            // safe: LOGO_SVG_WHITE is a compile-time constant, not user input
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: LOGO_SVG_WHITE }}
        />
    );
}

/** Semi-transparent overlay that centers the checkout card as a modal. */
function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
    return (
        <div
            onClick={onClose}
            style={{
                position:       'fixed',
                inset:          0,
                background:     'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(4px)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                zIndex:         99999,
                padding:        '16px',
            }}
        >
            {/* Stop click-through so clicks on the card don't close the modal */}
            <div
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '440px', width: '100%', position: 'relative' }}
            >
                <button
                    onClick={onClose}
                    aria-label="Close checkout"
                    style={{
                        position:     'absolute',
                        top:          '-12px',
                        right:        '-12px',
                        width:        '28px',
                        height:       '28px',
                        borderRadius: '50%',
                        background:   '#fff',
                        border:       '1px solid #e5e4e7',
                        cursor:       'pointer',
                        display:      'flex',
                        alignItems:   'center',
                        justifyContent: 'center',
                        fontSize:     '16px',
                        lineHeight:   1,
                        color:        '#6b6375',
                        zIndex:       1,
                        padding:      0,
                    }}
                >
                    ×
                </button>
                {children}
            </div>
        </div>
    );
}

/**
 * Floating trigger button variant of the checkout widget.
 *
 * Renders a 48 px indigo circle button with the Cyclo logo. Clicking it opens
 * the checkout card in a modal overlay. Clicking the overlay or the × button
 * closes the modal.
 *
 * Includes its own WagmiProvider and QueryClientProvider — safe to embed in
 * any host page without conflicting with the host's wagmi configuration.
 */
export function CycloFloatingButton({ planId, contractAddress, usdcAddress, rpcUrl = '/rpc' }: WidgetOptions) {
    const configRef = useRef<ReturnType<typeof createConfig> | undefined>(undefined);
    if (!configRef.current) {
        configRef.current = createConfig({
            chains:     [arcTestnet],
            connectors: [injected()],
            transports: { [arcTestnet.id]: http(rpcUrl) },
        });
    }

    const queryClientRef = useRef<QueryClient | undefined>(undefined);
    if (!queryClientRef.current) {
        queryClientRef.current = new QueryClient();
    }

    const [isOpen, setIsOpen] = useState(false);

    return (
        <WagmiProvider config={configRef.current}>
            <QueryClientProvider client={queryClientRef.current}>
                <TriggerButton onClick={() => setIsOpen(true)} />
                {isOpen && (
                    <ModalOverlay onClose={() => setIsOpen(false)}>
                        <CheckoutCard
                            planId={planId}
                            contractAddress={contractAddress}
                            usdcAddress={usdcAddress}
                        />
                    </ModalOverlay>
                )}
            </QueryClientProvider>
        </WagmiProvider>
    );
}
