import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  completeOnboarding,
  completeSportOnboarding,
  dismissCelebration,
  dismissQuiz,
  expectQuestion,
  openSportSession,
  toFirstExercise,
} from './helpers';

/**
 * Captures d'écran du README (Pixel 7, densité 2). Lancées seulement à la demande :
 * `CAPTURES=1 npx playwright test e2e/captures.spec.ts`.
 */
test.skip(!process.env['CAPTURES'], 'captures à la demande (CAPTURES=1)');
test.use({ deviceScaleFactor: 2, colorScheme: 'light' });

/** Attend que les photos visibles soient chargées (vraies images Unsplash : réseau). */
async function photosLoaded(page: Page): Promise<void> {
  await page.waitForFunction(
    () => Array.from(document.images).every((img) => img.complete),
    undefined,
    {
      timeout: 20_000,
    },
  );
  await page.waitForTimeout(300);
}

test('captures onboarding : un thème par écran, présenté par Nutry', async ({ page }) => {
  await page.goto('./');
  await expectQuestion(page, 'Tu as quel âge ?');
  await page.getByRole('button', { name: 'Augmenter : Âge' }).click();
  await page.getByRole('button', { name: 'Augmenter : Âge' }).click();
  await page.getByRole('button', { name: 'Augmenter : Âge' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/captures/onboarding.png' });
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expectQuestion(page, 'Tu es…');
  await page.getByText('Femme', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Enceinte ou allaitante/ })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/captures/onboarding-choix.png' });
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expectQuestion(page, 'Ta taille et ton poids ?');
  await page.getByLabel('Taille', { exact: true }).fill('165');
  await page.getByLabel('Poids', { exact: true }).fill('62');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/captures/onboarding-mesures.png' });
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('Un peu actif', { exact: true }).click();
  await page.getByRole('button', { name: 'Passer' }).click();
  await page.getByText('Rééquilibrer', { exact: true }).click();
  await expectQuestion(page, 'Tu manges comment ?');
  await page.getByText('Végétarien', { exact: true }).click();
  await page.getByText('Arachides', { exact: true }).click();
  await page.getByText('Œufs', { exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/captures/onboarding-nuage.png' });
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expectQuestion(page, /aimes, ou pas/);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expectQuestion(page, 'Comment tu t’organises ?');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/captures/onboarding-organisation.png' });
});

test('capture onboarding sur ordinateur : la carte reste centrée', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await expectQuestion(page, 'Tu as quel âge ?');
  await page.getByLabel('Âge', { exact: true }).fill('34');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('Femme', { exact: true }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expectQuestion(page, 'Ta taille et ton poids ?');
  await page.getByLabel('Taille', { exact: true }).fill('168');
  await page.getByLabel('Poids', { exact: true }).fill('64');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/captures/onboarding-ordinateur.png' });
});

test('captures Semaine, Courses, Moi, Nutry et Recette', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('./');
  await completeOnboarding(page);
  await expect(page.getByTestId('meal')).toHaveCount(1);
  // Le dîner du jour.
  await page.getByRole('tab', { name: 'Dîner' }).click();
  await page.waitForTimeout(400);
  await photosLoaded(page);
  await page.screenshot({ path: 'docs/captures/semaine.png' });

  await page
    .getByTestId('meal')
    .getByRole('link', { name: /^Voir la recette/ })
    .click();
  await expect(page.getByRole('tab', { name: 'Ingrédients' })).toBeVisible();
  await page.waitForTimeout(400);
  await photosLoaded(page);
  await page.screenshot({ path: 'docs/captures/recette.png' });

  await page.getByRole('link', { name: 'Courses' }).click();
  await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
  await page.getByTestId('shopping-list').getByRole('checkbox').first().click();
  // Premier geste : Nutry gagne une feuille ; on la lui met pour la capture de « Moi ».
  await dismissCelebration(page);
  await page.getByTestId('shopping-list').getByRole('checkbox').nth(1).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/captures/courses.png' });

  await page.getByRole('link', { name: 'Moi' }).click();
  await page.getByRole('button', { name: 'Personnaliser Nutry' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/captures/nutry-personnalisation.png' });
  await page.getByRole('button', { name: 'Framboise' }).click();
  await page.getByRole('tab', { name: 'Accessoires' }).click();
  await page.getByRole('button', { name: /Feuille sur la tête/ }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/captures/nutry-accessoires.png' });
  await page.getByRole('button', { name: 'Enregistrer ce look' }).click();
  await expect(page.getByRole('img', { name: /feuille sur la tête/ })).toBeVisible();
  // Laisse le toast « Nutry a changé de look ! » disparaître.
  await page.waitForTimeout(4600);
  await page.screenshot({ path: 'docs/captures/moi.png' });

  // L'assiette illustrée de la fiche recette.
  await page.getByRole('link', { name: 'Semaine' }).click();
  await page
    .getByTestId('meal')
    .getByRole('link', { name: /^Voir la recette/ })
    .click();
  await page.getByRole('tab', { name: 'Infos' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/captures/assiette.png' });
});

test('captures tablette (iPad) et ordinateur (1440 × 900) : Semaine', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('./');
  await completeOnboarding(page);
  await expect(page.getByTestId('meal')).toHaveCount(2);
  await page.waitForTimeout(500);
  await photosLoaded(page);
  await page.screenshot({ path: 'docs/captures/tablette.png' });

  await page.setViewportSize({ width: 1180, height: 820 });
  await page.waitForTimeout(500);
  await photosLoaded(page);
  await page.screenshot({ path: 'docs/captures/tablette-paysage.png' });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  await photosLoaded(page);
  await page.screenshot({ path: 'docs/captures/ordinateur.png' });

  await page.getByRole('link', { name: 'Courses' }).click();
  await page.getByTestId('shopping-list').getByRole('checkbox').first().click();
  await dismissCelebration(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/captures/courses-ordinateur.png' });
  await page.getByRole('link', { name: 'Moi' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/captures/moi-ordinateur.png' });
  await page.getByRole('button', { name: 'Personnaliser Nutry' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/captures/nutry-ordinateur.png' });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.getByRole('link', { name: 'Courses' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/captures/courses-tablette.png' });
});

test('capture Crédits photos', async ({ page }) => {
  await page.goto('./');
  await completeOnboarding(page);
  await page.goto('./#/credits-photos');
  await expect(page.getByRole('region', { name: 'Liste des crédits photos' })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/captures/credits-photos.png' });
});

test('captures Sport : onboarding, semaine, séance, tuto, ordinateur', async ({ page }) => {
  test.setTimeout(120_000);
  // Le mannequin animé : on montre le mouvement (et non les étapes de prefers-reduced-motion).
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./');
  await completeOnboarding(page);
  await dismissQuiz(page);
  await completeSportOnboarding(page, async (screen) => {
    if (screen === 3) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'docs/captures/onboarding-sport.png' });
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/captures/sport.png' });

  await openSportSession(page);
  await toFirstExercise(page);
  await page.getByRole('button', { name: 'Plus : Répétitions' }).click();
  await page.getByRole('button', { name: 'Valider la série 1' }).click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'docs/captures/seance.png' });
  await page.getByRole('button', { name: 'Passer' }).click();
  await page.getByRole('button', { name: 'Voir le tuto' }).click();
  await expect(page.getByRole('heading', { name: 'Comment faire' })).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/captures/tuto.png' });
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/captures/seance-ordinateur.png' });
  await page.getByRole('button', { name: 'Quitter la séance' }).click();
  await page.getByRole('button', { name: 'Reprendre plus tard' }).click();
  await dismissCelebration(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/captures/sport-ordinateur.png' });
});
