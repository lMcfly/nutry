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

/**
 * `test` de Playwright qui ÉCHOUE sur toute violation de la CSP (index.html) : événement
 * `securitypolicyviolation` ou message console « Content Security Policy ». Tous les tests
 * e2e l'importent d'ici.
 */
export const test = base.extend<{ cspViolations: CspViolation[] }>({
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
