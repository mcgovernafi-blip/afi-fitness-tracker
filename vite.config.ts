import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'

function spaFallback(): Plugin {
  let outDir = path.resolve('dist')
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const index = path.join(outDir, 'index.html')
      if (existsSync(index)) copyFileSync(index, path.join(outDir, '404.html'))
    },
  }
}

const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'AFI Fitness Tracker',
        short_name: 'AFI Fitness',
        description: 'Offline workout tracker for one person.',
        theme_color: '#0f6e56',
        background_color: '#121410',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [],
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
      },
    }),
    spaFallback(),
  ],
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts'],
    fileParallelism: false,
  },
})
