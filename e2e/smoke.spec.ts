import { expect, test } from './fixtures';

test('l’application se charge sur l’onboarding au premier lancement', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Bienvenue · Nutry');
  await expect(page).toHaveURL(/#\/bienvenue$/);
  await expect(page.getByRole('heading', { name: 'Faisons connaissance' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Progression' })).toBeVisible();
});
