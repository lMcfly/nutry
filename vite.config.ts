import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/**
 * `base` = nom du dépôt GitHub : l'app est servie sous https://<user>.github.io/nutry/.
 * Voir docs/adr/0003-routing-hashrouter-github-pages.md. Si le dépôt est renommé, changer
 * cette constante (manifest compris) et `BASE_PATH` dans playwright.config.ts.
 */
const BASE = '/nutry/';

/** Identité vert sauge / crème (alignée sur src/presentation/theme/tokens.css). */
const SAGE = '#3d6b4f';
const CREAM = '#fbf7f0';

export default defineConfig({
  base: BASE,
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
    VitePWA({
      /*
       * Mise à jour « douce » : une nouvelle version s'installe en arrière-plan puis attend.
       * Elle s'active quand l'app est fermée, ou quand elle passe en arrière-plan (onglet
       * masqué, autre app au premier plan) : jamais sous les doigts de la personne.
       * L'enregistrement est fait par le script de index.html (virtual:pwa-register).
       */
      registerType: 'prompt',
      injectRegister: false,
      // `globPatterns` couvre déjà public/ (icônes, favicon) et le plugin ajoute le manifest :
      // pas de doublon dans le précache.
      includeManifestIcons: false,
      manifest: {
        id: BASE,
        name: 'Nutry — bien manger, en douceur',
        short_name: 'Nutry',
        description:
          'Des menus de la semaine adaptés à ton profil, ta liste de courses et des petits ' +
          'quiz pour rééquilibrer ton alimentation sans régime. Tout reste sur ton appareil.',
        lang: 'fr',
        dir: 'ltr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: SAGE,
        background_color: CREAM,
        categories: ['health', 'food', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        /*
         * Tout le build est précaché, y compris les morceaux chargés à la demande
         * (catalogue de recettes, quiz, Zod) : hors ligne complet dès la première visite.
         */
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Aucune ressource tierce : pas de runtimeCaching.
      },
    }),
  ],
});
