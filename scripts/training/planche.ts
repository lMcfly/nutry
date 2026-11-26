/**
 * Captures de la planche des mannequins d'exercice (page de développement mannequins.html).
 *
 *   npx tsx --tsconfig tsconfig.node.json scripts/training/planche.ts <dossier> [nom=requête ...]
 *
 * Requête `ex=all` (ou `ex=id1,id2`, `from=0&count=48`) : un mannequin par exercice du catalogue,
 * avec son matériel réel (le catalogue est injecté dans la page).
 *
 * Construit mannequins.html avec Vite (même CSP que l'app), la sert en local, puis enregistre
 * une capture PNG par requête. Sans requête : planche femme, planche homme et trois séquences.
 * Échoue si la page enfreint la CSP ou si un élément porte un attribut `style`.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { build, preview } from 'vite';

const [outDir = 'mannequins', ...requests] = process.argv.slice(2);
const DEFAULTS = [
  'planche=body=female',
  'planche-homme=body=male',
  'seq-squat=seq=squat',
  'seq-pompe=seq=pompe',
  'seq-rowing=seq=rowing-unilateral',
];
const BUILD_DIR = join(outDir, '.build');
const EXERCISES = (
  JSON.parse(readFileSync('src/infrastructure/data/exercises.json', 'utf8')) as {
    exercises: { id: string; name: string; movement: string; equipment: string[] }[];
  }
).exercises.map(({ id, name, movement, equipment }) => ({ id, name, movement, equipment }));
const LOCAL_CHROMIUM = process.env['PW_CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium';

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  await build({
    logLevel: 'warn',
    build: {
      outDir: BUILD_DIR,
      emptyOutDir: true,
      rollupOptions: { input: 'mannequins.html' },
    },
  });
  const server = await preview({
    logLevel: 'warn',
    build: { outDir: BUILD_DIR },
    preview: { port: 4179, strictPort: true },
  });
  const browser = await chromium.launch(
    existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {},
  );
  try {
    for (const request of requests.length > 0 ? requests : DEFAULTS) {
      const [name, ...rest] = request.split('=');
      const query = rest.join('=');
      const page = await browser.newPage({
        deviceScaleFactor: 1.5,
        viewport: { width: 1200, height: 800 },
      });
      await page.addInitScript(`window.__EXERCISES__ = ${JSON.stringify(EXERCISES)};`);
      const violations: string[] = [];
      page.on('console', (message) => {
        if (/Content Security Policy|Refused to/i.test(message.text()))
          violations.push(message.text());
      });
      await page.goto(`http://localhost:4179/nutry/mannequins.html?${query}`);
      const planche = page.locator('#planche');
      await planche.waitFor();
      const box = await planche.boundingBox();
      if (box) {
        await page.setViewportSize({
          width: Math.ceil(box.width + box.x),
          height: Math.ceil(box.height + box.y),
        });
      }
      const styled = await page.locator('[style]').count();
      if (styled > 0) violations.push(`${styled} élément(s) avec un attribut style`);
      if (violations.length > 0) throw new Error(`CSP : ${violations.join(' | ')}`);
      await planche.screenshot({ path: join(outDir, `${name}.png`) });
      console.log(`${name}.png`);
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => {
      server.httpServer.close(() => {
        resolve();
      });
    });
  }
}

await main();
