import { expect, test } from './fixtures';
import { completeOnboarding, seriousViolations } from './helpers';

/** Grands écrans : navigation en rail latéral, mises en page à deux colonnes, axe sans violation. */
const WIDE = [
  { name: 'iPad portrait', size: { width: 820, height: 1180 } },
  { name: 'iPad paysage', size: { width: 1180, height: 820 } },
  { name: 'ordinateur', size: { width: 1440, height: 900 } },
] as const;

for (const wide of WIDE) {
  test.describe(wide.name, () => {
    test.use({ viewport: wide.size });

    test('rail de navigation à gauche, contenu centré, axe sans violation sérieuse', async ({
      page,
    }) => {
      await page.goto('./');
      await completeOnboarding(page);
      await expect(page.getByTestId('meal')).toHaveCount(1);

      const nav = page.getByRole('navigation', { name: 'Navigation principale' });
      const box = await nav.boundingBox();
      expect(box?.x).toBe(0);
      expect(box?.width ?? 0).toBeLessThan(140);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(wide.size.height - 1);

      const report: Record<string, unknown> = {};
      report['semaine'] = await seriousViolations(page);

      await page.getByRole('button', { name: 'Plus d’options' }).click();
      await expect(page.getByRole('dialog', { name: 'Cette semaine' })).toBeVisible();
      report['semaine-menu'] = await seriousViolations(page);
      await page.keyboard.press('Escape');

      await page.getByTestId('meal').getByRole('link').first().click();
      await expect(page.getByRole('tab', { name: 'Ingrédients' })).toBeVisible();
      report['recette'] = await seriousViolations(page);

      for (const [tab, title] of [
        ['Courses', 'Mes courses'],
        ['Profil', 'Mon profil'],
        ['Progrès', 'Mes progrès'],
      ] as const) {
        await page.getByRole('link', { name: tab }).click();
        await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
        report[tab] = await seriousViolations(page);
      }

      // Profil : la feuille de réglage devient un panneau à droite.
      await page.getByRole('link', { name: 'Profil' }).click();
      await page.getByRole('button', { name: 'Goûts' }).click();
      const panel = page.getByRole('dialog', { name: 'Goûts' });
      await expect(panel).toBeVisible();
      await expect
        .poll(async () => (await panel.boundingBox())?.x ?? 0)
        .toBeGreaterThan(wide.size.width / 2 - 50);
      report['profil-panneau'] = await seriousViolations(page);

      console.log(`Violations axe (${wide.name}) :`, JSON.stringify(report));
      for (const violations of Object.values(report)) expect(violations).toEqual([]);
    });
  });
}
