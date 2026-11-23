import { expect, test } from './fixtures';
import { completeOnboarding, dismissCelebration } from './helpers';

/**
 * Captures d'écran du README (Pixel 7, densité 2). Lancées seulement à la demande :
 * `CAPTURES=1 npx playwright test e2e/captures.spec.ts`.
 */
test.skip(!process.env['CAPTURES'], 'captures à la demande (CAPTURES=1)');
test.use({ deviceScaleFactor: 2, colorScheme: 'light' });

test('capture onboarding : Nutry accueille la personne', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Âge').fill('34');
  await page.getByLabel('Taille', { exact: true }).fill('172');
  await page.getByLabel('Poids', { exact: true }).fill('70');
  await page.getByText('Femme', { exact: true }).click();
  await expect(page.getByRole('img', { name: /^Nutry, la petite boule/ })).toBeVisible();
  await page.screenshot({ path: 'docs/captures/onboarding.png' });
});

test('captures Semaine, Courses, Profil et Recette', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('./');
  await completeOnboarding(page);
  await expect(page.getByTestId('meal')).toHaveCount(1);
  // Le dîner du jour.
  await page.getByRole('tab', { name: 'Dîner' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/captures/semaine.png' });

  await page
    .getByTestId('meal')
    .getByRole('link', { name: /^Voir la recette/ })
    .click();
  await expect(page.getByRole('tab', { name: 'Ingrédients' })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/captures/recette.png' });

  await page.getByRole('link', { name: 'Courses' }).click();
  await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
  await page.getByTestId('shopping-list').getByRole('checkbox').first().check();
  // Premier geste : Nutry gagne une feuille ; on la lui met pour la capture du profil.
  await dismissCelebration(page);
  await page.getByTestId('shopping-list').getByRole('checkbox').nth(1).check();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/captures/courses.png' });

  await page.getByRole('link', { name: 'Profil' }).click();
  await page.getByRole('button', { name: /Personnaliser/ }).click();
  await page.getByRole('button', { name: 'Framboise' }).click();
  await page.getByRole('tab', { name: 'Accessoires' }).click();
  await page.getByRole('button', { name: /Feuille sur la tête/ }).click();
  await page.getByRole('button', { name: 'Enregistrer ce look' }).click();
  await expect(page.getByRole('img', { name: /feuille sur la tête/ })).toBeVisible();
  // Laisse le toast « Nutry a changé de look ! » disparaître.
  await page.waitForTimeout(4600);
  await page.screenshot({ path: 'docs/captures/profil.png' });
});

test('captures tablette (iPad) et ordinateur (1440 × 900) : Semaine', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('./');
  await completeOnboarding(page);
  await expect(page.getByTestId('meal')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Dîner' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/captures/tablette.png' });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/captures/ordinateur.png' });
});
