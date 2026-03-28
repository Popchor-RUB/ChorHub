import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { normalizeBasePath } from './src/utils/basePath.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const basePath = normalizeBasePath(env.VITE_BASE_PATH)
  const projectRoot = path.dirname(fileURLToPath(import.meta.url))
  const httpsKeyPath = path.join(projectRoot, '.cert', 'dev-key.pem')
  const httpsCertPath = path.join(projectRoot, '.cert', 'dev-cert.pem')
  const hasHttpsCert = fs.existsSync(httpsKeyPath) && fs.existsSync(httpsCertPath)
  const httpsOptions = hasHttpsCert
    ? {
        key: fs.readFileSync(httpsKeyPath),
        cert: fs.readFileSync(httpsCertPath),
      }
    : undefined

  return {
    base: basePath,
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      https: httpsOptions,
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
