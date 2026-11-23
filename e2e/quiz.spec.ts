import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeOnboarding } from './helpers';

/** Ligne de série, visible seulement après une réponse. */
const STREAK = /Série : \d|Nouvelle série à la prochaine question/;

const quizCard = (page: Page) => page.getByRole('dialog', { name: /La question du moment/ });

/** Texte de la question affichée (premier paragraphe de la carte). */
async function questionOf(page: Page): Promise<string> {
  const card = quizCard(page);
  await expect(card).toBeVisible();
  return (await card.locator('p').first().innerText()).trim();
}

test('une nouvelle question à chaque ouverture, la même pendant la session', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await completeOnboarding(page);
  // Fin de l'onboarding : pas de carte dans cette session.
  await expect(quizCard(page)).toBeHidden();

  // 1re ouverture : un nouvel onglet a un sessionStorage vide (même IndexedDB).
  const first = await context.newPage();
  await first.goto('./');
  const firstQuestion = await questionOf(first);
  // Réponse : la série démarre (ou reste à 0), le résultat s'affiche.
  await quizCard(first).getByRole('button').filter({ hasText: /^A/ }).click();
  await expect(quizCard(first).getByText(STREAK).first()).toBeVisible();
  // Première réponse : Nutry gagne sa première feuille, la célébration passe devant la carte.
  const celebration = first.getByRole('dialog', { name: 'Bravo !' });
  await expect(celebration).toBeVisible();
  await celebration.getByRole('button', { name: 'Génial !' }).click();
  await expect(celebration).toBeHidden();
  await first.keyboard.press('Escape');
  await expect(quizCard(first)).toBeHidden();
  // Laisse l'acquittement de la célébration s'écrire avant de recharger.
  await first.waitForTimeout(300);

  // Rechargement dans la même session : pas de nouvelle carte…
  await first.reload();
  await expect(first.getByRole('heading', { name: 'Ma semaine' })).toBeVisible();
  await expect(quizCard(first)).toBeHidden();
  // … et si la carte se rouvre (repère d'affichage retiré), même question et son résultat.
  // (code évalué dans la page : chaîne, le tsconfig des tests n'a pas les types DOM)
  await first.evaluate("sessionStorage.removeItem('nutry.quiz.session')");
  await first.reload();
  expect(await questionOf(first)).toBe(firstQuestion);
  await expect(quizCard(first).getByText(STREAK).first()).toBeVisible();
  await first.close();

  // 2e ouverture (sessionStorage vidé) : une autre question, encore sans réponse.
  await page.evaluate('sessionStorage.clear()');
  await page.reload();
  const secondQuestion = await questionOf(page);
  expect(secondQuestion).not.toBe(firstQuestion);
  await expect(quizCard(page).getByText(STREAK).first()).toBeHidden();
});
