import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Attend la question de Nutry (titre de niveau 1 de l'écran). */
export async function expectQuestion(page: Page, name: string | RegExp): Promise<void> {
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

const next = (page: Page) => page.getByRole('button', { name: 'Continuer' });
const skip = (page: Page) => page.getByRole('button', { name: 'Passer' });

/**
 * Onboarding complet, au plus court mais avec des choix réels : une question par écran, les
 * cartes de choix passent seules à la suite, « Passer » écarte les questions facultatives.
 */
export async function completeOnboarding(page: Page): Promise<void> {
  await expectQuestion(page, 'Tu as quel âge ?');
  await page.getByLabel('Âge', { exact: true }).fill('34');
  await next(page).click();

  await expectQuestion(page, 'Tu es…');
  await page.getByText('Homme', { exact: true }).click();

  await expectQuestion(page, 'Tu mesures combien ?');
  await page.getByLabel('Taille', { exact: true }).fill('172');
  await next(page).click();

  await expectQuestion(page, 'Et tu pèses combien ?');
  await page.getByLabel('Poids', { exact: true }).fill('70');
  await next(page).click();

  await expectQuestion(page, 'Tu connais ton tour de taille ?');
  await skip(page).click();

  await expectQuestion(page, 'Tu bouges comment au quotidien ?');
  await page.getByText('Un peu actif', { exact: true }).click();

  await expectQuestion(page, /condition de santé/);
  await skip(page).click();

  await expectQuestion(page, 'Quel est ton objectif ?');
  await page.getByText('Rééquilibrer', { exact: true }).click();

  await expectQuestion(page, 'Tu manges comment ?');
  await page.getByText('Omnivore', { exact: true }).click();

  await expectQuestion(page, /« sans »/);
  await skip(page).click();

  await expectQuestion(page, 'Tu as des allergies ?');
  await page.getByText('Arachides', { exact: true }).click();
  await next(page).click();

  await expectQuestion(page, 'Qu’est-ce que tu adores ?');
  await page.getByText('Tomate', { exact: true }).click();
  await next(page).click();

  await expectQuestion(page, 'Et ce que tu n’aimes pas ?');
  await skip(page).click();

  await expectQuestion(page, 'Vous êtes combien à table ?');
  await page.getByRole('button', { name: 'Une personne de plus' }).click();
  await next(page).click();

  // Temps, niveaux, petit-déjeuner : les réponses par défaut conviennent.
  for (const question of [
    'Tu as combien de temps pour cuisiner en semaine ?',
    'Et le week-end ?',
    'En semaine, tu préfères cuisiner comment ?',
    'Et le week-end ?',
    'Je te propose aussi un petit-déjeuner ?',
  ]) {
    await expectQuestion(page, question);
    await skip(page).click();
  }

  await expectQuestion(page, 'Tu veux cuisiner en avance le dimanche ?');
  await page.getByRole('button', { name: 'Voir mon menu' }).click();
  await expect(page.getByRole('heading', { name: 'Ma semaine' })).toBeVisible();
}

/**
 * Ferme la carte quiz : elle s'ouvre une fois par ouverture de l'app, un instant après le
 * chargement, donc on lui laisse le temps d'apparaître avant de conclure qu'il n'y en a pas.
 */
export async function dismissQuiz(page: Page): Promise<void> {
  const quiz = page.getByRole('dialog', { name: /La question du moment/ });
  try {
    await quiz.waitFor({ state: 'visible', timeout: 3000 });
  } catch {
    return;
  }
  await page.keyboard.press('Escape');
  await expect(quiz).toBeHidden();
}

/** Violations axe sérieuses ou critiques (WCAG A/AA). */
export async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, help: v.help, targets: v.nodes.map((n) => n.target.join(' ')) }));
}

/** Ferme la célébration « Nutry a gagné … ! » si elle est ouverte (premier geste du jour). */
export async function dismissCelebration(page: Page): Promise<void> {
  const celebration = page.getByRole('dialog', { name: 'Bravo !' });
  try {
    await celebration.waitFor({ state: 'visible', timeout: 3000 });
  } catch {
    return;
  }
  await celebration.getByRole('button', { name: 'Génial !' }).click();
  await expect(celebration).toBeHidden();
}

/** Les 7 jours du bandeau de la semaine. */
export const dayTabs = (page: Page) =>
  page.getByRole('tablist', { name: 'Jours de la semaine' }).getByRole('tab');

/** Noms des repas de la semaine, du premier au dernier, en parcourant « Repas suivant ». */
export async function collectWeekNames(page: Page): Promise<string[]> {
  await dayTabs(page).first().click();
  const lunch = page.getByRole('tab', { name: 'Déjeuner' });
  if (await lunch.isVisible()) await lunch.click();
  const next = page.getByRole('button', { name: 'Repas suivant' });
  const names: string[] = [];
  for (let i = 0; i < 30; i += 1) {
    names.push((await page.getByTestId('meal').getByRole('heading').innerText()).trim());
    if (await next.isDisabled()) break;
    await next.click();
  }
  return names;
}
