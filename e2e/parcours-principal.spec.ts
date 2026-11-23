import { expect, test } from '@playwright/test';
import { completeOnboarding, dismissQuiz, seriousViolations } from './helpers';

test('parcours principal : onboarding → menu → remplacement → courses → rechargement', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page).toHaveURL(/#\/bienvenue$/);

  // Onboarding en moins de 2 minutes (on mesure le temps réel du parcours).
  const start = Date.now();
  await completeOnboarding(page);
  const onboardingMs = Date.now() - start;
  test.info().annotations.push({ type: 'durée onboarding', description: `${onboardingMs} ms` });
  console.log(`Durée de l'onboarding : ${onboardingMs} ms`);
  expect(onboardingMs).toBeLessThan(120_000);

  // Semaine : 14 repas (déjeuner + dîner, sans petit-déjeuner).
  const meals = page.getByTestId('meal');
  await expect(meals).toHaveCount(14);
  await expect(page.getByRole('meter')).toHaveCount(4);

  // Remplacer le premier repas.
  const first = meals.first();
  const before = await first.getByRole('heading').innerText();
  await first.getByRole('button', { name: /Remplacer/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Remplacer ce repas' });
  await expect(sheet).toBeVisible();
  const option = sheet.getByRole('list', { name: 'Alternatives' }).getByRole('button').first();
  const chosen = (await option.locator('span').first().innerText()).trim();
  await option.click();
  await expect(sheet).toBeHidden();
  await expect(first.getByRole('heading')).toHaveText(chosen);
  expect(chosen).not.toBe(before);

  // Courses groupées par rayon, dans l'ordre du magasin.
  await page.getByRole('link', { name: 'Courses' }).click();
  await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
  const sections = page.getByRole('heading', { level: 2 });
  await expect(sections.first()).toContainText('Fruits et légumes');
  const fruits = page.locator('section', {
    has: page.getByRole('heading', { name: /Fruits et légumes/ }),
  });
  const item = fruits.getByRole('checkbox').first();
  const itemName = await fruits.locator('label').first().innerText();
  await item.check();
  await expect(item).toBeChecked();

  // Rechargement : tout est conservé.
  await page.reload();
  await dismissQuiz(page);
  await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
  await expect(
    page.locator('label', { hasText: itemName.split('\n')[0] ?? '' }).getByRole('checkbox'),
  ).toBeChecked();
  await page.getByRole('link', { name: 'Semaine' }).click();
  await expect(page.getByTestId('meal')).toHaveCount(14);
  await expect(page.getByTestId('meal').first().getByRole('heading')).toHaveText(chosen);
});

test('fonctionne hors ligne après une première visite', async ({ page, context }) => {
  await page.goto('./');
  await completeOnboarding(page);
  // Le service worker doit contrôler la page (précache installé).
  // (code évalué dans la page : chaîne, le tsconfig des tests n'a pas les types DOM)
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
  await page.reload();
  await page.waitForFunction('navigator.serviceWorker.controller !== null');

  await context.setOffline(true);
  await page.reload();
  await dismissQuiz(page);
  await expect(page.getByRole('heading', { name: 'Ma semaine' })).toBeVisible();
  await expect(page.getByTestId('meal')).toHaveCount(14);
  await page.getByRole('link', { name: 'Courses' }).click();
  await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
  // Écrans chargés à la demande : leurs morceaux sont précachés.
  await page.getByRole('link', { name: 'Profil' }).click();
  await expect(page.getByRole('heading', { name: 'Mon profil', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Progrès' }).click();
  await expect(page.getByRole('heading', { name: 'Mes progrès', level: 1 })).toBeVisible();
  await context.setOffline(false);
});

test('accessibilité : aucune violation axe sérieuse sur les écrans principaux', async ({
  page,
}) => {
  await page.goto('./');
  const report: Record<string, unknown> = {};
  report['onboarding'] = await seriousViolations(page);
  await completeOnboarding(page);
  await expect(page.getByTestId('meal')).toHaveCount(14);
  report['semaine'] = await seriousViolations(page);

  for (const [tab, title] of [
    ['Courses', 'Mes courses'],
    ['Profil', 'Mon profil'],
    ['Progrès', 'Mes progrès'],
  ] as const) {
    await page.getByRole('link', { name: tab }).click();
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
    report[tab] = await seriousViolations(page);
  }
  await page.goto('./#/frigo');
  await expect(page.getByRole('heading', { name: 'Frigo vide', level: 1 })).toBeVisible();
  report['frigo'] = await seriousViolations(page);

  // Thème sombre forcé.
  await page.goto('./#/profil');
  await page.getByText('Sombre', { exact: true }).click();
  await page.getByRole('link', { name: 'Semaine' }).click();
  await expect(page.getByTestId('meal')).toHaveCount(14);
  report['semaine-sombre'] = await seriousViolations(page);

  console.log('Violations axe :', JSON.stringify(report));
  for (const violations of Object.values(report)) expect(violations).toEqual([]);
});
