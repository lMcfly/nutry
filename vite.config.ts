import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
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

/**
 * La CSP de index.html interdit les scripts en ligne ; or le serveur de développement
 * injecte le préambule React Refresh en ligne. On la retire donc en `vite` (serve)
 * uniquement : `vite build` et `vite preview` (e2e) servent la page avec la CSP.
 */
const CSP_META = /\s*<meta\s+http-equiv="Content-Security-Policy"[^>]*>/;
const devWithoutCsp = (): Plugin => ({
  name: 'nutry:dev-without-csp',
  apply: 'serve',
  transformIndexHtml: (html) => html.replace(CSP_META, ''),
});

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
    devWithoutCsp(),
    react(),
    VitePWA({
      /*
       * Mise à jour « douce » : une nouvelle version s'installe en arrière-plan puis attend
       * la prochaine ouverture de l'app (jamais de rechargement pendant l'utilisation).
       * L'enregistrement est fait par src/infrastructure/pwa/register.ts, chargé par
       * index.html (voir serviceWorker.ts et docs/DEPLOIEMENT.md).
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
        // Les photos de plats (public/photos, ~5 Mo) ne sont pas précachées : mises en cache
        // à la première vue (runtimeCaching ci-dessous), l'illustration prend le relais sinon.
        globIgnores: ['photos/**'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Seules ressources mises en cache à l'exécution : les photos de l'app elle-même et
        // celles d'Unsplash (images.unsplash.com, ADR 0014). Réponses opaques (statut 0) :
        // les <img> cross-origin sans CORS.
        runtimeCaching: [
          {
            // Expression régulière (pas une fonction) : le service worker est généré en
            // sérialisant ce code, où la constante BASE n'existe pas.
            urlPattern: new RegExp(`${BASE}photos/`),
            handler: 'CacheFirst',
            options: {
              cacheName: 'nutry-photos',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'nutry-photos-unsplash',
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
});
