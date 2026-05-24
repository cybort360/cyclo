/**
 * Vanilla JS mount API for embedding the checkout widget without a React build step.
 *
 * Usage:
 *   <script src="cyclo-widget.iife.js"></script>
 *   <div id="checkout"></div>
 *   <script>
 *     CycloWidget.mount('#checkout', {
 *       planId:          1,
 *       rpcUrl:          'https://rpc.testnet.arc-node.thecanteenapp.com/v1/...',
 *       contractAddress: '0x...',
 *       usdcAddress:     '0x...',
 *     });
 *   </script>
 */
import { createElement } from 'react';
import { createRoot }    from 'react-dom/client';
import { CycloCheckout, CycloFloatingButton } from './Widget';

export interface MountOptions {
    planId:          number | bigint;
    contractAddress: string;
    usdcAddress:     string;
    rpcUrl?:         string;
}

/**
 * Mounts the Cyclo checkout widget into a DOM element.
 * @param selector — CSS selector for the container element
 * @param options  — planId (number or bigint), contractAddress, usdcAddress, optional rpcUrl
 */
export function mount(selector: string, options: MountOptions): void {
    const container = document.querySelector(selector);
    if (!container) throw new Error(`CycloWidget: no element found for selector "${selector}"`);

    createRoot(container).render(
        createElement(CycloCheckout, {
            planId:          BigInt(options.planId),
            contractAddress: options.contractAddress,
            usdcAddress:     options.usdcAddress,
            rpcUrl:          options.rpcUrl,
        }),
    );
}

/**
 * Mounts the Cyclo floating trigger button into a DOM element.
 *
 * Renders a 48 px indigo circle button with the Cyclo logo. Clicking it opens
 * the checkout card in a full-screen modal overlay.
 *
 * Usage:
 *   <div id="cyclo-btn"></div>
 *   <script>
 *     CycloWidget.mountButton('#cyclo-btn', {
 *       planId:          1,
 *       rpcUrl:          'https://...',
 *       contractAddress: '0x...',
 *       usdcAddress:     '0x...',
 *     });
 *   </script>
 *
 * @param selector — CSS selector for the container element
 * @param options  — planId (number or bigint), contractAddress, usdcAddress, optional rpcUrl
 */
export function mountButton(selector: string, options: MountOptions): void {
    const container = document.querySelector(selector);
    if (!container) throw new Error(`CycloWidget: no element found for selector "${selector}"`);

    createRoot(container).render(
        createElement(CycloFloatingButton, {
            planId:          BigInt(options.planId),
            contractAddress: options.contractAddress,
            usdcAddress:     options.usdcAddress,
            rpcUrl:          options.rpcUrl,
        }),
    );
}
