import { expect, test } from './fixtures';
import { completeOnboarding } from './helpers';

/**
 * Captures d'écran du README (Pixel 7, densité 2). Lancées seulement à la demande :
 * `CAPTURES=1 npx playwright test e2e/captures.spec.ts`.
 */
test.skip(!process.env['CAPTURES'], 'captures à la demande (CAPTURES=1)');
test.use({ deviceScaleFactor: 2, colorScheme: 'light' });

test('capture onboarding', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Âge').fill('34');
  await page.getByLabel('Taille', { exact: true }).fill('172');
  await page.getByLabel('Poids', { exact: true }).fill('70');
  await page.getByText('Femme', { exact: true }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByRole('heading', { name: 'Ton objectif' })).toBeVisible();
  await page.screenshot({ path: 'docs/captures/onboarding.png' });
});

test('captures Semaine et Courses', async ({ page }) => {
  await page.goto('./');
  await completeOnboarding(page);
  await expect(page.getByTestId('meal')).toHaveCount(14);
  await page.getByRole('heading', { level: 2 }).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/captures/semaine.png' });

  await page.getByRole('link', { name: 'Courses' }).click();
  await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
  await page.getByRole('checkbox').first().check();
  await page.screenshot({ path: 'docs/captures/courses.png' });
});
