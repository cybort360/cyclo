import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['react', 'wagmi', 'viem', '@tanstack/react-query', '@cyclo/sdk'],
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' }
  },
})
