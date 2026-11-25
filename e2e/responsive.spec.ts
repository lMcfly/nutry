import { expect, test } from './fixtures';
import {
  completeOnboarding,
  completeSportOnboarding,
  dismissQuiz,
  openSportSession,
  toFirstExercise,
  seriousViolations,
} from './helpers';

/** Grands écrans : navigation en rail latéral, mises en page à deux colonnes, axe sans violation. */
const WIDE = [
  { name: 'iPad portrait', size: { width: 820, height: 1180 } },
  { name: 'iPad paysage', size: { width: 1180, height: 820 } },
  { name: 'ordinateur', size: { width: 1440, height: 900 } },
] as const;

for (const wide of WIDE) {
  test.describe(wide.name, () => {
    test.use({ viewport: wide.size });

    test('rail de navigation à gauche (4 entrées), contenu centré, axe sans violation sérieuse', async ({
      page,
    }) => {
      await page.goto('./');
      await completeOnboarding(page);
      // Les repas du jour sont ensemble (déjeuner et dîner), sans onglets.
      await expect(page.getByTestId('meal')).toHaveCount(2);
      await expect(page.getByRole('tab', { name: 'Dîner' })).toHaveCount(0);
      const [first, second] = await page.getByTestId('meal').all();
      const a = await first?.boundingBox();
      const b = await second?.boundingBox();
      if (wide.size.width >= 1000) {
        // Côte à côte : même hauteur, deuxième carte à droite.
        expect(Math.abs((a?.y ?? 0) - (b?.y ?? 1))).toBeLessThan(2);
        expect(b?.x ?? 0).toBeGreaterThan((a?.x ?? 0) + (a?.width ?? 0) - 2);
      } else {
        // Empilées : même colonne, la deuxième sous la première.
        expect(Math.abs((a?.x ?? 0) - (b?.x ?? 1))).toBeLessThan(2);
        expect(b?.y ?? 0).toBeGreaterThan((a?.y ?? 0) + (a?.height ?? 0) - 2);
      }
      // « Ta semaine » : dès 1280 px, ou en bande sur une tablette portrait haute (≥ 1000 px).
      const { width, height } = wide.size;
      const withAside = width >= 1280 || (width >= 768 && width <= 999 && height >= 1000);
      await expect(page.getByRole('complementary', { name: 'Ta semaine' })).toHaveCount(
        withAside ? 1 : 0,
      );

      const nav = page.getByRole('navigation', { name: 'Navigation principale' });
      const box = await nav.boundingBox();
      await expect(nav.getByRole('link')).toHaveText(['Semaine', 'Sport', 'Courses', 'Moi']);
      expect(box?.x).toBe(0);
      expect(box?.width ?? 0).toBeLessThan(140);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(wide.size.height - 1);

      const report: Record<string, unknown> = {};
      report['semaine'] = await seriousViolations(page);

      await page.getByRole('button', { name: 'Plus d’options' }).click();
      await expect(page.getByRole('dialog', { name: 'Cette semaine' })).toBeVisible();
      report['semaine-menu'] = await seriousViolations(page);
      await page.keyboard.press('Escape');

      await page.getByTestId('meal').first().getByRole('link').first().click();
      await expect(page.getByRole('tab', { name: 'Ingrédients' })).toBeVisible();
      report['recette'] = await seriousViolations(page);

      for (const [tab, title] of [
        ['Courses', 'Mes courses'],
        ['Moi', 'Moi'],
      ] as const) {
        await page.getByRole('link', { name: tab }).click();
        await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
        report[tab] = await seriousViolations(page);
      }

      // Moi : Nutry et la série à gauche, les progrès à droite (2 colonnes dès 768 px).
      await page.getByRole('link', { name: 'Moi' }).click();
      const hero = await page.getByRole('button', { name: 'Personnaliser Nutry' }).boundingBox();
      const cards = await page.getByRole('button', { name: /Favoris/ }).boundingBox();
      expect(cards?.x ?? 0).toBeGreaterThan((hero?.x ?? 0) + (hero?.width ?? 0));
      // Les réglages : la feuille devient un panneau à droite.
      await page.getByRole('button', { name: 'Réglages' }).click();
      await page
        .getByRole('dialog', { name: 'Réglages' })
        .getByRole('button', { name: 'Goûts' })
        .click();
      const panel = page.getByRole('dialog', { name: 'Goûts' });
      await expect(panel).toBeVisible();
      // Panneau collé à droite, sans couvrir tout l'écran.
      await expect
        .poll(async () => {
          const box = await panel.boundingBox();
          return Math.round((box?.x ?? 0) + (box?.width ?? 0));
        })
        .toBeGreaterThanOrEqual(wide.size.width - 2);
      expect((await panel.boundingBox())?.x ?? 0).toBeGreaterThan(wide.size.width * 0.2);
      report['moi-panneau'] = await seriousViolations(page);

      console.log(`Violations axe (${wide.name}) :`, JSON.stringify(report));
      for (const violations of Object.values(report)) expect(violations).toEqual([]);
    });
  });
}

for (const wide of WIDE) {
  test.describe(`Sport, ${wide.name}`, () => {
    test.use({ viewport: wide.size });

    test('Sport et séance utilisent la largeur, axe sans violation sérieuse', async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto('./');
      await completeOnboarding(page);
      await dismissQuiz(page);
      const report: Record<string, unknown> = {};
      await completeSportOnboarding(page);
      report['sport'] = await seriousViolations(page);
      await openSportSession(page);
      await toFirstExercise(page);
      report['seance'] = await seriousViolations(page);

      // Mannequin à gauche, détails à droite dès 1000 px ; au-dessus en tablette portrait.
      const figure = await page.locator('main [data-figure]').first().boundingBox();
      const name = await page.getByRole('heading', { level: 2 }).boundingBox();
      if (wide.size.width >= 1000) {
        expect(name?.x ?? 0).toBeGreaterThan((figure?.x ?? 0) + (figure?.width ?? 0) - 2);
      } else {
        expect(name?.y ?? 0).toBeGreaterThan((figure?.y ?? 0) + (figure?.height ?? 0) - 2);
      }
      expect(figure?.height ?? 0).toBeGreaterThan(wide.size.height * 0.4);

      await page.getByRole('button', { name: /Valider la série/ }).click();
      await expect(page.getByRole('region', { name: 'Repos' })).toBeVisible();
      report['repos'] = await seriousViolations(page);
      await page.getByRole('button', { name: 'Passer' }).click();
      await page.getByRole('button', { name: 'Voir le tuto' }).click();
      await expect(page.getByRole('heading', { name: 'Comment faire' })).toBeVisible();
      report['tuto'] = await seriousViolations(page);

      console.log(`Violations axe Sport (${wide.name}) :`, JSON.stringify(report));
      for (const violations of Object.values(report)) expect(violations).toEqual([]);
    });
  });
}
