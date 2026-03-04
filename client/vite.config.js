import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:3001';

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
            },
            '/images': {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
            }
        }
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './vitest.setup.js',
    }
})
