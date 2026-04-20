import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../web',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router'))
              return 'vendor-react'
            if (id.includes('framer-motion'))
              return 'vendor-motion'
            if (id.includes('@radix-ui'))
              return 'vendor-radix'
            if (id.includes('recharts') || id.includes('d3-'))
              return 'vendor-charts'
            if (id.includes('@mdxeditor') || id.includes('@codemirror') || id.includes('@lezer'))
              return 'vendor-editor'
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
