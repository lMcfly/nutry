import { expect, test } from '@playwright/test';

test('l’application se charge sur la page Semaine', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Nutry');
  await expect(page).toHaveURL(/#\/semaine$/);
  await expect(page.getByRole('heading', { name: 'Ma semaine' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
});
