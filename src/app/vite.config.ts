import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [tailwindcss(), react()],
    server: {
      historyApiFallback: true,
      proxy: {
        '/rpc': {
          target:       env.VITE_ARC_RPC_URL,
          changeOrigin: true,
          rewrite:      (path) => path.replace(/^\/rpc/, ''),
        },
        '/api': {
          target:       'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  }
})
