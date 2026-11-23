import { expect, test } from './fixtures';
import {
  collectWeekNames,
  completeOnboarding,
  dayTabs,
  dismissCelebration,
  dismissQuiz,
  seriousViolations,
} from './helpers';

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

  // Semaine : une grande carte (le repas du jour), 7 jours dans le bandeau, 3 jauges d'assiette.
  const first = page.getByTestId('meal');
  await expect(first).toHaveCount(1);
  await expect(dayTabs(page)).toHaveCount(7);
  await expect(dayTabs(page).and(page.locator('[aria-selected="true"]'))).toHaveAccessibleName(
    /aujourd’hui/,
  );
  await expect(first.getByRole('meter')).toHaveCount(3);
  // 14 repas dans la semaine (déjeuner + dîner, sans petit-déjeuner), parcourus de proche en proche.
  expect(await collectWeekNames(page)).toHaveLength(14);
  await page.getByRole('tab', { name: /aujourd’hui/ }).click();
  await page.getByRole('tab', { name: 'Déjeuner' }).click();

  // Remplacer le repas du jour.
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

  // Courses : un onglet par rayon (dans l'ordre du magasin), la liste du rayon actif en carte.
  await page.getByRole('link', { name: 'Courses' }).click();
  await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
  const rayons = page.getByRole('tablist', { name: 'Rayons' }).getByRole('tab');
  await expect(rayons.first()).toHaveAccessibleName(/^Fruits et légumes/);
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Fruits et légumes');
  const fruits = page.getByTestId('shopping-list');
  const item = fruits.getByRole('checkbox').first();
  const itemName = await fruits.locator('label').first().innerText();
  await item.check();
  await expect(item).toBeChecked();
  await expect(page.getByText(/^1\/\d+ dans le panier$/)).toBeVisible();
  // Premier geste du jour : Nutry gagne sa première feuille.
  await dismissCelebration(page);
  // La case réagit tout de suite : on attend que l'écriture soit enregistrée avant de recharger.
  await expect(page.getByTestId('shopping-list')).toHaveAttribute('aria-busy', 'false');

  // Rechargement : tout est conservé.
  await page.reload();
  await dismissQuiz(page);
  await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
  await expect(
    page.locator('label', { hasText: itemName.split('\n')[0] ?? '' }).getByRole('checkbox'),
  ).toBeChecked();
  await page.getByRole('link', { name: 'Semaine' }).click();
  await expect(page.getByTestId('meal')).toHaveCount(1);
  await expect(page.getByTestId('meal').getByRole('heading')).toHaveText(chosen);
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
  await expect(page.getByTestId('meal')).toHaveCount(1);
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
  await expect(page.getByTestId('meal')).toHaveCount(1);
  report['semaine'] = await seriousViolations(page);

  // Feuilles de la Semaine : équilibre, puis fenêtre « Nouveau menu ».
  await page.getByRole('button', { name: 'Équilibre de la semaine' }).click();
  await expect(page.getByRole('dialog', { name: 'L’équilibre de ta semaine' })).toBeVisible();
  report['semaine-equilibre'] = await seriousViolations(page);
  await page.keyboard.press('Escape');

  // Une recette : onglets Ingrédients, Étapes, Infos.
  await page.getByTestId('meal').getByRole('link', { name: 'Voir la recette' }).click();
  await expect(page.getByRole('tab', { name: 'Ingrédients' })).toBeVisible();
  report['recette'] = await seriousViolations(page);
  await page.getByRole('tab', { name: 'Étapes' }).click();
  report['recette-etapes'] = await seriousViolations(page);
  await page.getByRole('tab', { name: 'Infos' }).click();
  report['recette-infos'] = await seriousViolations(page);

  for (const [tab, title] of [
    ['Courses', 'Mes courses'],
    ['Profil', 'Mon profil'],
    ['Progrès', 'Mes progrès'],
  ] as const) {
    await page.getByRole('link', { name: tab }).click();
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
    report[tab] = await seriousViolations(page);
  }

  // Profil : feuille plein écran d'une tuile, personnalisation de Nutry.
  await page.getByRole('link', { name: 'Profil' }).click();
  await page.getByRole('button', { name: 'Goûts' }).click();
  await expect(page.getByRole('dialog', { name: 'Goûts' })).toBeVisible();
  report['profil-gouts'] = await seriousViolations(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Personnaliser/ }).click();
  await expect(page.getByRole('dialog', { name: 'Personnaliser Nutry' })).toBeVisible();
  report['nutry-couleur'] = await seriousViolations(page);
  await page.getByRole('tab', { name: 'Accessoires' }).click();
  report['nutry-accessoires'] = await seriousViolations(page);
  await page.keyboard.press('Escape');

  await page.goto('./#/frigo');
  await expect(page.getByRole('heading', { name: 'Frigo vide', level: 1 })).toBeVisible();
  report['frigo'] = await seriousViolations(page);

  // Thème sombre forcé.
  await page.goto('./#/profil');
  await page.getByRole('button', { name: 'Apparence et suivi' }).click();
  await page.getByText('Sombre', { exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Semaine' }).click();
  await expect(page.getByTestId('meal')).toHaveCount(1);
  report['semaine-sombre'] = await seriousViolations(page);
  await page.getByRole('link', { name: 'Progrès' }).click();
  await expect(page.getByRole('heading', { name: 'Mes progrès', level: 1 })).toBeVisible();
  report['progres-sombre'] = await seriousViolations(page);
  await page.getByRole('link', { name: 'Courses' }).click();
  await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
  report['courses-sombre'] = await seriousViolations(page);

  console.log('Violations axe :', JSON.stringify(report));
  for (const violations of Object.values(report)) expect(violations).toEqual([]);
});
