import { expect, test } from './fixtures';
import {
  completeOnboarding,
  completeSportOnboarding,
  dayTabs,
  dismissCelebration,
  dismissQuiz,
  openSportSession,
  pickSportDay,
  seriousViolations,
  sportDayTabs,
  toFirstExercise,
} from './helpers';

/**
 * Parcours Sport (ADR 0015) : onboarding Sport → semaine d'entraînement → séance (séries
 * validées, minuteur de repos, tuto, douleur) → fin, avec Nutry et la série du jour.
 */
test('parcours sport : onboarding, séance guidée, minuteur, tuto, douleur, fin', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('./');
  await completeOnboarding(page);
  await dismissQuiz(page);

  // Quatre onglets, dans l'ordre.
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('link')).toHaveText(['Semaine', 'Sport', 'Courses', 'Moi']);

  await completeSportOnboarding(page);
  await expect(page.getByRole('note')).toContainText('Nutry ne remplace pas un coach');
  await expect(sportDayTabs(page)).toHaveCount(7);
  // Trois jours de séance repérés dans le bandeau du Sport…
  const tabs = await sportDayTabs(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('aria-label') ?? ''),
  );
  expect(tabs.filter((l) => !l.endsWith(', repos'))).toHaveLength(3);
  // …et dans celui de la Semaine, sans en changer la hauteur.
  await page.getByRole('link', { name: 'Semaine' }).click();
  await expect(dayTabs(page).filter({ hasText: /./ })).toHaveCount(7);
  await expect(page.getByRole('tab', { name: /jour de séance/ })).toHaveCount(3);
  await page.getByRole('link', { name: 'Sport' }).click();

  // Séance : mode concentré, sans barre d'onglets.
  await openSportSession(page);
  await expect(nav).toHaveCount(0);
  await expect(page.getByText(/^Échauffement · 1 sur/)).toBeVisible();
  await toFirstExercise(page);
  const firstName = await page.getByRole('heading', { level: 2 }).innerText();

  // Valider une série lance le minuteur de repos ; +15 s, puis Passer.
  await page.getByRole('button', { name: 'Plus : Répétitions' }).click();
  await page.getByRole('button', { name: 'Valider la série 1' }).click();
  const rest = page.getByRole('region', { name: 'Repos' });
  await expect(rest.getByRole('timer')).toBeVisible();
  await rest.getByRole('button', { name: 'Ajouter 15 secondes de repos' }).click();
  await rest.getByRole('button', { name: 'Passer' }).click();
  await expect(rest).toBeHidden();
  await expect(page.getByRole('button', { name: /^Série 1 sur \d, faite/ })).toBeVisible();

  // Le tuto : mannequin, consignes, lien YouTube sortant.
  await page.getByRole('button', { name: 'Voir le tuto' }).click();
  const tuto = page.getByRole('dialog', { name: `Tuto : ${firstName}` });
  await expect(tuto.getByRole('heading', { name: 'Comment faire' })).toBeVisible();
  await expect(tuto.locator('[data-figure]').first()).toBeVisible();
  const video = tuto.getByRole('link', { name: /^Voir une vidéo/ });
  await expect(video).toHaveAttribute(
    'href',
    /^https:\/\/www\.youtube\.com\/results\?search_query=/,
  );
  await expect(video).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(video).toHaveAttribute('target', '_blank');
  await tuto.getByRole('button', { name: 'Fermer le tuto' }).click();

  // « Ça fait mal » : confirmation, messages, remplacement.
  await page.getByRole('button', { name: 'Ça fait mal' }).click();
  await page.getByRole('button', { name: 'Oui, ça fait mal' }).click();
  const care = page.getByRole('dialog', { name: 'Prends soin de toi' });
  await expect(care).toContainText('Arrête cet exercice');
  await expect(care).toContainText('appelle le 15');
  await care.getByRole('button', { name: /D’accord/ }).click();
  await expect(page.getByRole('heading', { level: 2 })).not.toHaveText(firstName);

  // Une série du remplaçant, puis fin de séance.
  await page.getByRole('button', { name: 'Valider la série 1' }).click();
  await page.getByRole('region', { name: 'Repos' }).getByRole('button', { name: 'Passer' }).click();
  await page.getByRole('button', { name: 'Quitter la séance' }).click();
  await page.getByRole('button', { name: 'Terminer maintenant' }).click();
  const effort = page.getByRole('dialog', { name: 'Comment c’était ?' });
  await effort.getByText('Correct').click();
  await effort.getByRole('button', { name: 'Terminer la séance' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /Bravo, séance terminée/ }),
  ).toBeVisible();
  await expect(page.getByText(/Nutry gagne/)).toContainText('le bandeau');
  await expect(page.getByRole('img', { name: /^Nutry/ })).toBeVisible();

  await page.getByRole('link', { name: 'Retour à ma semaine' }).click();
  await dismissCelebration(page);
  await expect(page.getByText('1 séance sur 3')).toBeVisible();
  await pickSportDay(page, true);
  await expect(page.getByRole('button', { name: 'Revoir la séance' })).toBeVisible();

  // Historique : la séance faite.
  await page.getByRole('button', { name: 'Mes séances' }).click();
  const history = page.getByRole('dialog', { name: 'Mes séances' });
  await expect(history).toContainText('1 séance terminée');
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');

  // Rechargement : tout est gardé.
  await page.reload();
  await expect(page.getByText('1 séance sur 3')).toBeVisible();
});

test('séance au clavier seulement, axe sans violation sérieuse', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('./');
  await completeOnboarding(page);
  await dismissQuiz(page);
  await completeSportOnboarding(page);
  expect(await seriousViolations(page)).toEqual([]);
  await openSportSession(page);
  expect(await seriousViolations(page)).toEqual([]);
  await toFirstExercise(page);
  const validate = page.getByRole('button', { name: 'Valider la série 1' });
  await validate.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Repos' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Passer' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Voir le tuto' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: /^Tuto/ })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Voir le tuto' })).toBeFocused();
});
