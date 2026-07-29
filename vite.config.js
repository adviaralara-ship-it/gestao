import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'logo-login.png'],
      workbox: {
        maximumFileSizeToCacheInBytes: 5242880 // 5 MB
      },
      manifest: {
        name: 'Alpha Gestão Condominial',
        short_name: 'Alpha',
        description: 'Sistema profissional de gestão de condomínios',
        theme_color: '#1a1f36',
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
