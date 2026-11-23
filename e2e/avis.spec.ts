import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('👎 « pas aimé » puis « Nouveau menu » : le plat n’est plus dans la semaine', async ({
  page,
}) => {
  await page.goto('./');
  await completeOnboarding(page);

  const meals = page.getByTestId('meal');
  await expect(meals).toHaveCount(14);
  const first = meals.first();
  const disliked = (await first.getByRole('heading').innerText()).trim();

  await first.getByRole('button', { name: 'Pas pour moi' }).click();
  await first.getByText('Pas aimé le goût', { exact: true }).click();
  // Le toast propose de remplacer le plat tout de suite.
  await expect(page.getByRole('button', { name: 'Remplacer ce plat maintenant' })).toBeVisible();

  await page.getByRole('button', { name: /Nouveau menu/ }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Un nouveau menu ?' });
  await confirm.getByRole('button', { name: 'Oui, on change' }).click();
  await expect(page.getByText('Ton nouveau menu est prêt.')).toBeVisible();

  await expect(meals).toHaveCount(14);
  const names = (await meals.getByRole('heading').allInnerTexts()).map((n) => n.trim());
  expect(names).not.toContain(disliked);
});
