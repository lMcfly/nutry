import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Onboarding complet, au plus court mais avec des choix réels. */
export async function completeOnboarding(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Faisons connaissance' })).toBeVisible();
  await page.getByLabel('Âge').fill('34');
  await page.getByLabel('Taille', { exact: true }).fill('172');
  await page.getByLabel('Poids', { exact: true }).fill('70');
  await page.getByText('Homme', { exact: true }).click();
  await page.getByText('Un peu actif', { exact: true }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expect(page.getByRole('heading', { name: 'Ton objectif' })).toBeVisible();
  await page.getByText('Arachides', { exact: true }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expect(page.getByRole('heading', { name: 'Tes goûts' })).toBeVisible();
  await page
    .getByRole('group', { name: /J’adore/ })
    .getByText('Tomate')
    .click();
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expect(page.getByRole('heading', { name: 'Ton organisation' })).toBeVisible();
  await page.getByRole('button', { name: 'Une personne de plus' }).click();
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
