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

  // Semaine : une grande carte (le repas du jour), 7 jours dans le bandeau, carte épurée sans jauge.
  const first = page.getByTestId('meal');
  await expect(first).toHaveCount(1);
  await expect(dayTabs(page)).toHaveCount(7);
  await expect(dayTabs(page).and(page.locator('[aria-selected="true"]'))).toHaveAccessibleName(
    /aujourd’hui/,
  );
  await expect(first.getByRole('meter')).toHaveCount(0);
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
  // Tuiles : un gros emoji, le nom et la quantité ; la case porte le nom complet.
  const itemName = (await fruits.getByRole('checkbox').first().getAttribute('aria-label')) ?? '';
  expect(itemName).toMatch(/\S/);
  await fruits.getByRole('checkbox', { name: itemName }).click();
  await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();
  // La tuile cochée rejoint la section repliable « Dans le panier (1) ».
  const basket = page.getByRole('button', { name: 'Dans le panier (1)' });
  await expect(basket).toHaveAttribute('aria-expanded', 'false');
  // Premier geste du jour : Nutry gagne sa première feuille.
  await dismissCelebration(page);
  // La case réagit tout de suite : on attend que l'écriture soit enregistrée avant de recharger.
  await expect(page.getByTestId('shopping-list')).toHaveAttribute('aria-busy', 'false');

  // Rechargement : tout est conservé.
  await page.reload();
  await dismissQuiz(page);
  await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Dans le panier (1)' }).click();
  await expect(
    page.getByTestId('shopping-list').getByRole('checkbox', { name: itemName, checked: true }),
  ).toBeVisible();
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
  await page.getByRole('link', { name: 'Moi' }).click();
  await expect(page.getByRole('heading', { name: 'Moi', level: 1 })).toBeVisible();
  await context.setOffline(false);
});

test('accessibilité : aucune violation axe sérieuse sur les écrans principaux', async ({
  page,
}) => {
  await page.goto('./');
  const report: Record<string, unknown> = {};
  report['onboarding'] = await seriousViolations(page);
  // Quelques autres écrans de l'onboarding : carte de choix, nuage de puces.
  await page.getByLabel('Âge', { exact: true }).fill('34');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByRole('heading', { name: 'Tu es…', level: 1 })).toBeVisible();
  report['onboarding-choix'] = await seriousViolations(page);
  // Écrans groupés : taille et poids côte à côte, puis régime et allergies en nuages.
  await page.getByText('Homme', { exact: true }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ta taille et ton poids ?', level: 1 }),
  ).toBeVisible();
  report['onboarding-mesures'] = await seriousViolations(page);
  await page.getByRole('button', { name: '+ Ajouter mon tour de taille' }).click();
  await expect(page.getByLabel('Tour de taille', { exact: true })).toBeVisible();
  report['onboarding-mesures-tour-de-taille'] = await seriousViolations(page);
  await page.getByLabel('Taille', { exact: true }).fill('172');
  await page.getByLabel('Poids', { exact: true }).fill('70');
  await page.getByRole('button', { name: 'Retirer mon tour de taille' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('Un peu actif', { exact: true }).click();
  await page.getByRole('button', { name: 'Passer' }).click();
  await page.getByText('Rééquilibrer', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu manges comment ?', level: 1 })).toBeVisible();
  report['onboarding-regime-allergies'] = await seriousViolations(page);
  await page.reload();
  await completeOnboarding(page);
  await expect(page.getByTestId('meal')).toHaveCount(1);
  report['semaine'] = await seriousViolations(page);

  // Feuilles de la Semaine : équilibre, puis fenêtre « Nouveau menu ».
  await page.getByRole('button', { name: 'Plus d’options' }).click();
  await page.getByRole('button', { name: 'Équilibre de la semaine' }).click();
  await expect(page.getByRole('dialog', { name: 'L’équilibre de ta semaine' })).toBeVisible();
  report['semaine-equilibre'] = await seriousViolations(page);
  await page.keyboard.press('Escape');

  // Une recette : onglets Ingrédients, Étapes, Infos.
  await page
    .getByTestId('meal')
    .getByRole('link', { name: /^Voir la recette/ })
    .click();
  await expect(page.getByRole('tab', { name: 'Ingrédients' })).toBeVisible();
  report['recette'] = await seriousViolations(page);
  await page.getByRole('tab', { name: 'Étapes' }).click();
  report['recette-etapes'] = await seriousViolations(page);
  await page.getByRole('tab', { name: 'Infos' }).click();
  report['recette-infos'] = await seriousViolations(page);

  for (const [tab, title] of [
    ['Courses', 'Mes courses'],
    ['Moi', 'Moi'],
  ] as const) {
    await page.getByRole('link', { name: tab }).click();
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
    report[tab] = await seriousViolations(page);
  }

  // Moi : réglages dans le ⚙, feuille plein écran d'une tuile, personnalisation de Nutry.
  await page.getByRole('link', { name: 'Moi' }).click();
  await page.getByRole('button', { name: 'Réglages' }).click();
  report['moi-reglages'] = await seriousViolations(page);
  await page
    .getByRole('dialog', { name: 'Réglages' })
    .getByRole('button', { name: 'Goûts' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Goûts' })).toBeVisible();
  report['moi-gouts'] = await seriousViolations(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Personnaliser Nutry' }).click();
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
  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Apparence et suivi' }).click();
  await page.getByText('Sombre', { exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Semaine' }).click();
  await expect(page.getByTestId('meal')).toHaveCount(1);
  report['semaine-sombre'] = await seriousViolations(page);
  await page.getByRole('link', { name: 'Moi' }).click();
  await expect(page.getByRole('heading', { name: 'Moi', level: 1 })).toBeVisible();
  report['moi-sombre'] = await seriousViolations(page);
  await page.getByRole('link', { name: 'Courses' }).click();
  await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
  report['courses-sombre'] = await seriousViolations(page);

  console.log('Violations axe :', JSON.stringify(report));
  for (const violations of Object.values(report)) expect(violations).toEqual([]);
});
