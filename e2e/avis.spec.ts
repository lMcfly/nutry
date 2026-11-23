import { expect, test } from './fixtures';
import { collectWeekNames, completeOnboarding, dayTabs, dismissCelebration } from './helpers';

test('👎 « pas aimé » puis « Nouveau menu » : le plat n’est plus dans la semaine', async ({
  page,
}) => {
  await page.goto('./');
  await completeOnboarding(page);

  const meal = page.getByTestId('meal');
  await expect(meal).toHaveCount(1);
  await expect(dayTabs(page)).toHaveCount(7);
  const disliked = (await meal.getByRole('heading').innerText()).trim();

  await meal.getByRole('button', { name: 'Pas pour moi' }).click();
  const reasons = page.getByRole('dialog', { name: 'Une raison ?' });
  await reasons.getByText('Pas aimé le goût', { exact: true }).click();
  // Le toast propose de remplacer le plat tout de suite.
  await expect(page.getByRole('button', { name: 'Remplacer ce plat maintenant' })).toBeVisible();
  // Premier geste du jour : Nutry gagne sa première feuille.
  await dismissCelebration(page);

  await page.getByRole('button', { name: 'Plus d’options' }).click();
  await page.getByRole('button', { name: 'Nouveau menu' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Un nouveau menu ?' });
  await confirm.getByRole('button', { name: 'Oui, on change' }).click();
  await expect(page.getByText('Ton nouveau menu est prêt.')).toBeVisible();

  const names = await collectWeekNames(page);
  expect(names).toHaveLength(14);
  expect(names).not.toContain(disliked);
});
