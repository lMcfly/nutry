/// <reference lib="dom" />
// Le script d'initialisation s'exécute dans le navigateur : types DOM requis.
import { expect, test as base } from '@playwright/test';

/** Violation de la Content Security Policy relevée dans la page. */
export interface CspViolation {
  directive: string;
  blockedURI: string;
  sourceFile: string;
  line: number;
}

/** Petite image 4:3 (8 × 6) : les photos Unsplash des e2e, sans dépendre du réseau. */
const PLACEHOLDER_PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGM4Mi0FK2IYSAkAk95ToZfw3mAAAAAASUVORK5CYII=',
  'base64',
);

/** Hôte des photos distantes (seule exception de la CSP `img-src`). */
export const UNSPLASH_HOST = 'https://images.unsplash.com';

/**
 * `test` de Playwright qui ÉCHOUE sur toute violation de la CSP (index.html) : événement
 * `securitypolicyviolation` ou message console « Content Security Policy ». Tous les tests
 * e2e l'importent d'ici. Les photos d'images.unsplash.com sont simulées (déterministe, hors
 * ligne), y compris pour le service worker ; `CAPTURES=1` les laisse charger pour de vraies
 * captures (voir `e2e/captures.spec.ts`).
 */
export const test = base.extend<{ cspViolations: CspViolation[]; unsplashMock: boolean }>({
  unsplashMock: [
    async ({ context }, use) => {
      if (!process.env['CAPTURES']) {
        await context.route(`${UNSPLASH_HOST}/**`, (route) =>
          route.fulfill({
            status: 200,
            contentType: 'image/png',
            headers: { 'access-control-allow-origin': '*' },
            body: PLACEHOLDER_PHOTO,
          }),
        );
      }
      await use(!process.env['CAPTURES']);
    },
    { auto: true },
  ],
  cspViolations: [
    async ({ page }, use) => {
      const violations: CspViolation[] = [];
      await page.exposeFunction('__nutryCspViolation', (v: CspViolation) => {
        violations.push(v);
      });
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          const report = (window as unknown as Record<string, (v: unknown) => void>)[
            '__nutryCspViolation'
          ];
          report?.({
            directive: event.effectiveDirective,
            blockedURI: event.blockedURI,
            sourceFile: event.sourceFile,
            line: event.lineNumber,
          });
        });
      });
      page.on('console', (message) => {
        if (/Content Security Policy/i.test(message.text())) {
          violations.push({
            directive: 'console',
            blockedURI: message.text(),
            sourceFile: message.location().url,
            line: message.location().lineNumber,
          });
        }
      });
      await use(violations);
      expect(violations, 'violations de la CSP').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
