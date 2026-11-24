import { expect, test } from './fixtures';
import { completeOnboarding } from './helpers';

test('l’application se charge sur l’onboarding au premier lancement', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Bienvenue · Nutry');
  await expect(page).toHaveURL(/#\/bienvenue$/);
  await expect(page.getByRole('heading', { name: 'Faisons connaissance' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Progression' })).toBeVisible();
});

test('les photos des plats s’affichent, sous la CSP, avec leur nom en texte alternatif', async ({
  page,
}) => {
  await page.goto('./');
  await completeOnboarding(page);
  // Une recette qui a sa photo (la carte du jour est au hasard, parfois sans photo).
  await page.goto('./#/recette/chili-sin-carne-express');
  const photo = page.locator('img[src*="/photos/chili-sin-carne-express.webp"]');
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(photo).toHaveAttribute('alt', /\S/);
});
