/// <reference lib="dom" />
// Les callbacks de page.evaluate s’exécutent dans le navigateur : types DOM requis.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures';

/** Chemin public de l'app (base Vite, voir vite.config.ts). */
const BASE_PATH = '/nutry/';

/** Fichiers du build (dist/ est produit par le webServer de Playwright avant les tests). */
const DIST_ASSETS = readdirSync(fileURLToPath(new URL('../dist/assets/', import.meta.url)));

interface ManifestIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}

interface WebManifest {
  name: string;
  short_name: string;
  lang: string;
  start_url: string;
  scope: string;
  id?: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
}

test.describe('PWA', () => {
  test('fonctionne hors ligne dès la première visite', async ({ page, context }) => {
    await page.goto('./');
    await expect(page.locator('#root')).not.toBeEmpty();

    // Service worker actif : le précache (installation) est terminé.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    // Tout le build est précaché, y compris les morceaux chargés à la demande.
    const cached = await page.evaluate(async () => {
      const paths: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) paths.push(new URL(request.url).pathname);
      }
      return paths;
    });
    const assetPaths = DIST_ASSETS.map((file) => `${BASE_PATH}assets/${file}`);
    expect(assetPaths.length).toBeGreaterThan(1);
    expect(cached).toEqual(expect.arrayContaining([...assetPaths, `${BASE_PATH}index.html`]));
    // Rien ne vient d'un autre domaine.
    const origins = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) urls.push(new URL(request.url).origin);
      }
      return [...new Set(urls)];
    });
    expect(origins).toEqual([new URL(page.url()).origin]);

    await context.setOffline(true);

    // Rechargement hors ligne : l'app s'affiche (le titre varie selon l'écran : « Bienvenue · Nutry »…).
    await page.reload();
    await expect(page).toHaveTitle(/Nutry/);
    await expect(page.locator('#root')).not.toBeEmpty();

    // Les morceaux paresseux (recettes, quiz, Zod…) restent accessibles hors ligne.
    const statuses = await page.evaluate(
      (paths) => Promise.all(paths.map(async (path) => (await fetch(path)).status)),
      assetPaths,
    );
    expect(statuses.every((status) => status === 200)).toBe(true);

    // Une navigation vers une adresse inconnue du scope retombe sur index.html.
    await page.goto(`${BASE_PATH}une/adresse/inconnue`);
    await expect(page).toHaveTitle(/Nutry/);
    await expect(page.locator('#root')).not.toBeEmpty();

    await context.setOffline(false);
  });

  test('le manifeste est valide et ses icônes existent', async ({ page, request }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe(`${BASE_PATH}manifest.webmanifest`);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      `${BASE_PATH}icons/apple-touch-icon.png`,
    );

    const response = await request.get('manifest.webmanifest');
    expect(response.status()).toBe(200);
    const manifest = (await response.json()) as WebManifest;

    expect(manifest).toMatchObject({
      name: 'Nutry — bien manger, en douceur',
      short_name: 'Nutry',
      lang: 'fr',
      start_url: BASE_PATH,
      scope: BASE_PATH,
      id: BASE_PATH,
      display: 'standalone',
    });
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);

    const find = (sizes: string, purpose: string): ManifestIcon | undefined =>
      manifest.icons.find(
        (icon) => icon.sizes === sizes && (icon.purpose ?? 'any').split(' ').includes(purpose),
      );
    const required = [find('192x192', 'any'), find('512x512', 'any'), find('512x512', 'maskable')];

    for (const icon of required) {
      expect(icon).toBeDefined();
      if (!icon) continue;
      // Les `src` sont relatifs au manifeste.
      const url = new URL(icon.src, response.url()).toString();
      const image = await request.get(url);
      expect(image.status(), url).toBe(200);
      expect(image.headers()['content-type']).toContain('image/png');
      const png = await image.body();
      const side = Number(icon.sizes.split('x')[0]);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([side, side]);
    }

    // Le service worker est servi à la racine du scope.
    const sw = await request.get('sw.js');
    expect(sw.status()).toBe(200);
  });
});
