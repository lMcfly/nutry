import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/**
 * `base` = nom du dépôt GitHub : l'app est servie sous https://<user>.github.io/nutry/.
 * Voir docs/adr/0003-routing-hashrouter-github-pages.md.
 */
export default defineConfig({
  base: '/nutry/',
  resolve: {
    alias: {
      '@domain': fromRoot('./src/domain'),
      '@application': fromRoot('./src/application'),
      '@infrastructure': fromRoot('./src/infrastructure'),
      '@presentation': fromRoot('./src/presentation'),
    },
  },
  plugins: [
    react(),
    // Configuration minimale : manifest complet, icônes et stratégie de cache en phase 6.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Nutry',
        short_name: 'Nutry',
        description: 'Rééquilibrer son alimentation en douceur',
        lang: 'fr',
        start_url: '/nutry/',
        scope: '/nutry/',
        display: 'standalone',
        theme_color: '#2f855a',
        background_color: '#ffffff',
      },
    }),
  ],
});
