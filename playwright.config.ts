import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Le service worker passe aussi par les routes Playwright (photos Unsplash simulées, voir e2e/fixtures.ts).
process.env['PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS'] = '1';

const PORT = 4173;
const BASE_PATH = '/nutry/';

/**
 * Chromium préinstallé localement (révision différente de celle attendue par
 * @playwright/test). En CI, `npx playwright install --with-deps chromium` suffit et
 * ce chemin n'existe pas : Playwright prend alors son navigateur par défaut.
 */
const LOCAL_CHROMIUM = process.env['PW_CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium';
const executablePath = existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  // En CI : annotations GitHub + rapport HTML (publié comme artefact si un test échoue).
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'on-first-retry',
    // Animations coupées (et passage automatique immédiat à l'onboarding) : parcours plus rapides
    // et prefers-reduced-motion exercé en continu.
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
