import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    // Caminhos relativos: a mesma build serve em localhost e numa subpasta do GitHub Pages.
    base: './',
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo-icon-no-bg.svg'],
            manifest: {
                name: 'Teleponto',
                short_name: 'Teleponto',
                description: 'Teleponto que segue a voz e grava o vídeo',
                lang: 'pt-PT',
                theme_color: '#000000',
                background_color: '#000000',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '.',
                scope: '.',
                icons: [
                    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
                ]
            }
        })
    ]
})
