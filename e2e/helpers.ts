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

/** Ferme la carte quiz si elle est ouverte. */
export async function dismissQuiz(page: Page): Promise<void> {
  const quiz = page.getByRole('dialog', { name: /La question du jour/ });
  if (await quiz.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await expect(quiz).toBeHidden();
  }
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
