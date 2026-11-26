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
 * Onboarding complet, au plus court mais avec des choix réels : neuf écrans thématiques, les
 * écrans à choix unique passent seuls à la suite, « Passer » écarte les écrans facultatifs.
 * `onScreen` est appelé à l'arrivée sur chaque écran (numéro de 1 à 9).
 */
export async function completeOnboarding(
  page: Page,
  onScreen?: (screen: number) => Promise<void>,
): Promise<void> {
  let screen = 0;
  await expectQuestion(page, 'Tu as quel âge ?');
  await onScreen?.((screen += 1));
  await page.getByLabel('Âge', { exact: true }).fill('34');
  await next(page).click();

  await expectQuestion(page, 'Tu es…');
  await onScreen?.((screen += 1));
  await page.getByText('Homme', { exact: true }).click();
  await next(page).click();

  await expectQuestion(page, 'Ta taille et ton poids ?');
  await onScreen?.((screen += 1));
  await page.getByLabel('Taille', { exact: true }).fill('172');
  await page.getByLabel('Poids', { exact: true }).fill('70');
  await next(page).click();

  await expectQuestion(page, 'Tu bouges comment au quotidien ?');
  await onScreen?.((screen += 1));
  await page.getByText('Un peu actif', { exact: true }).click();

  await expectQuestion(page, /condition de santé/);
  await onScreen?.((screen += 1));
  await skip(page).click();

  await expectQuestion(page, 'Quel est ton objectif ?');
  await onScreen?.((screen += 1));
  await page.getByText('Rééquilibrer', { exact: true }).click();

  await expectQuestion(page, 'Tu manges comment ?');
  await onScreen?.((screen += 1));
  await page.getByText('Omnivore', { exact: true }).click();
  await page.getByText('Arachides', { exact: true }).click();
  await next(page).click();

  await expectQuestion(page, /aimes, ou pas/);
  await onScreen?.((screen += 1));
  await page.getByRole('group', { name: 'J’adore' }).getByText('Tomate', { exact: true }).click();
  await next(page).click();

  await expectQuestion(page, 'Comment tu t’organises ?');
  await onScreen?.((screen += 1));
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

/**
 * Onboarding Sport depuis l'onglet Sport : invitation de Nutry, six questions (3 séances, jours
 * proposés, à la maison, débutant, en forme, 30 min), garde-fous et « J'ai compris ».
 * `onScreen` est appelé sur chaque écran (numéro à partir de 1 ; l'invitation est l'écran 0).
 */
export async function completeSportOnboarding(
  page: Page,
  onScreen?: (screen: number) => Promise<void>,
): Promise<void> {
  const nextBtn = page.getByRole('button', { name: 'Continuer' });
  await page.getByRole('link', { name: 'Sport' }).click();
  await expect(page.getByRole('heading', { name: /Envie de bouger avec Nutry/ })).toBeVisible();
  await onScreen?.(0);
  await page.getByRole('link', { name: 'Oui, on essaie' }).click();
  await expectQuestion(page, /Combien de fois par semaine/);
  await onScreen?.(1);
  await page.getByText('3 fois', { exact: true }).click();
  await expectQuestion(page, /Quels jours te conviennent/);
  await onScreen?.(2);
  await nextBtn.click();
  await expectQuestion(page, /Où t’entraînes-tu/);
  await onScreen?.(3);
  await nextBtn.click();
  await expectQuestion(page, /Quel est ton niveau/);
  await onScreen?.(4);
  await page.getByText('Débutant', { exact: true }).click();
  await expectQuestion(page, /Quel est ton objectif/);
  await onScreen?.(5);
  await page.getByText('Me sentir en forme', { exact: true }).click();
  await expectQuestion(page, /Combien de temps par séance/);
  await onScreen?.(6);
  await page.getByRole('button', { name: 'Créer mon programme' }).click();
  await expectQuestion(page, /bouger en sécurité/);
  await onScreen?.(7);
  await page.getByRole('button', { name: 'J’ai compris' }).click();
  await expect(page.getByRole('heading', { name: 'Sport', level: 1 })).toBeVisible();
}

/** Jours du bandeau de l'onglet Sport. */
export const sportDayTabs = (page: Page) =>
  page.getByRole('tablist', { name: 'Jours de la semaine d’entraînement' }).getByRole('tab');

/** Choisit, dans le bandeau du Sport, le premier jour avec (ou sans) séance. */
export async function pickSportDay(page: Page, withSession: boolean): Promise<void> {
  const tabs = sportDayTabs(page);
  await expect(tabs).toHaveCount(7);
  const count = await tabs.count();
  for (let i = 0; i < count; i += 1) {
    const label = (await tabs.nth(i).getAttribute('aria-label')) ?? '';
    if (label.endsWith(', repos') !== withSession) {
      await tabs.nth(i).click();
      return;
    }
  }
  throw new Error(`aucun jour ${withSession ? 'de séance' : 'de repos'}`);
}

/** Ouvre la première séance de la semaine (mode concentré). */
export async function openSportSession(page: Page): Promise<void> {
  await pickSportDay(page, true);
  await page.getByRole('button', { name: /Commencer la séance|Reprendre la séance/ }).click();
  await expect(page.getByRole('progressbar', { name: 'Progression de la séance' })).toBeVisible();
}

/** Avance jusqu'au premier exercice principal (après l'échauffement). */
export async function toFirstExercise(page: Page): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    if (await page.getByRole('button', { name: /Valider la série/ }).isVisible()) return;
    await page.getByRole('button', { name: 'Exercice suivant' }).click();
  }
  throw new Error('pas d’exercice principal');
}

/**
 * Passe le niveau d'activité du profil à « Sédentaire » (Moi › Réglages › Moi) : avec le
 * programme de Sport, la carte « Ton niveau d'activité pourrait monter d'un cran » apparaît.
 */
export async function setActivitySedentary(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Moi' }).click();
  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('dialog', { name: 'Réglages' }).getByRole('button', { name: 'Moi' }).click();
  const sheet = page.getByRole('dialog', { name: 'Moi' });
  await sheet.getByText('Sédentaire', { exact: true }).click();
  await sheet.getByRole('button', { name: 'Enregistrer mes réponses' }).click();
  // L'enregistrement ferme la feuille.
  await expect(sheet).toBeHidden();
}
