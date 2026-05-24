/**
 * Cyclo embeddable checkout widget.
 *
 * React usage:
 *   import { CycloCheckout } from './cyclo-widget.es.js';
 *   <CycloCheckout planId={1n} rpcUrl="https://..." contractAddress="0x..." usdcAddress="0x..." />
 *
 * Vanilla JS usage (IIFE build):
 *   <script src="cyclo-widget.iife.js"></script>
 *   <script>CycloWidget.mount('#checkout', { planId: 1, rpcUrl: '...', contractAddress: '...', usdcAddress: '...' })</script>
 */
export { CycloCheckout, CycloFloatingButton } from './Widget';
export type { WidgetOptions }                 from './Widget';
export { mount, mountButton }                 from './mount';
export type { MountOptions }                  from './mount';
