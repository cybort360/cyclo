/**
 * Vite config for the embeddable widget library build.
 *
 * Produces two self-contained bundles in dist/widget/:
 *   cyclo-widget.iife.js  — for <script> tag use; exposes window.CycloWidget
 *   cyclo-widget.es.js    — for ES module import in bundled React apps
 *
 * Build: cd src/app && npm run build:widget
 */
import { defineConfig } from 'vite';
import react            from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            entry:    'src/widget/index.ts',
            name:     'CycloWidget',
            formats:  ['iife', 'es'],
            fileName: (format) => `cyclo-widget.${format}.js`,
        },
        outDir:        'dist/widget',
        rollupOptions: {
            external: [],
            output:   { globals: {} },
        },
    },
});
