/// <reference lib="dom" />
// Les callbacks de page.evaluate s’exécutent dans le navigateur : types DOM requis.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeOnboarding } from './helpers';

/**
 * Règle de mise en page : chaque écran principal tient dans la hauteur de l'écran, sans
 * défilement de la page (seules les listes défilent, à l'intérieur de leur carte).
 * Mesuré en 360 × 640 (petit Android) et sur Pixel 7 (viewport du projet).
 */
const VIEWPORTS = [
  { name: '360 × 640', size: { width: 360, height: 640 } },
  { name: 'Pixel 7', size: undefined },
] as const;

interface Fit {
  readonly scrollHeight: number;
  readonly innerHeight: number;
  /** Débordement du contenu de `<main>` (contenu coupé ou poussé hors de sa zone). */
  readonly mainOverflow: number;
  /** Bas de la barre d'onglets : doit rester dans l'écran. */
  readonly tabBarBottom: number;
}

async function measure(page: Page): Promise<Fit> {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    const tabBar = document.querySelector('nav[aria-label="Navigation principale"]');
    return {
      scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
      innerHeight: window.innerHeight,
      mainOverflow: main ? main.scrollHeight - main.clientHeight : 0,
      tabBarBottom: tabBar ? tabBar.getBoundingClientRect().bottom : 0,
    };
  });
}

async function expectFits(page: Page, label: string): Promise<void> {
  const fit = await measure(page);
  const where = `${label} : ${JSON.stringify(fit)}`;
  expect(fit.scrollHeight, `défilement de la page, ${where}`).toBeLessThanOrEqual(
    fit.innerHeight + 1,
  );
  expect(fit.mainOverflow, `contenu qui déborde de la coque, ${where}`).toBeLessThanOrEqual(1);
  expect(fit.tabBarBottom, `barre d'onglets, ${where}`).toBeLessThanOrEqual(fit.innerHeight + 1);
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    if (viewport.size) test.use({ viewport: viewport.size });

    test('Semaine, Courses, Profil, Progrès et Recette tiennent sans scroll de page', async ({
      page,
    }) => {
      await page.goto('./');
      await expectFits(page, 'onboarding, étape 1');
      await completeOnboarding(page);

      // Semaine : le repas du jour, puis chaque jour du bandeau (illustration et titres variés).
      await expect(page.getByTestId('meal')).toHaveCount(1);
      await expectFits(page, 'Semaine');
      const days = page.getByRole('tablist', { name: 'Jours de la semaine' }).getByRole('tab');
      for (let i = 0; i < (await days.count()); i += 1) {
        await days.nth(i).click();
        await expect(days.nth(i)).toHaveAttribute('aria-selected', 'true');
        await expectFits(page, `Semaine, jour ${i + 1}`);
      }
      await page.getByRole('tab', { name: 'Dîner' }).click();
      await expectFits(page, 'Semaine, dîner');

      await page.getByRole('link', { name: 'Courses' }).click();
      await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
      await expectFits(page, 'Courses');
      const rayons = page.getByRole('tablist', { name: 'Rayons' }).getByRole('tab');
      await rayons.nth(1).click();
      await expectFits(page, 'Courses, 2e rayon');

      await page.getByRole('link', { name: 'Profil' }).click();
      await expect(page.getByRole('heading', { name: 'Mon profil', level: 1 })).toBeVisible();
      await expect(page.getByRole('img', { name: /^Nutry, la petite boule/ })).toBeVisible();
      await expectFits(page, 'Profil');

      await page.getByRole('link', { name: 'Progrès' }).click();
      await expect(page.getByRole('heading', { name: 'Mes progrès', level: 1 })).toBeVisible();
      await expect(page.getByRole('meter')).toHaveCount(4);
      await expectFits(page, 'Progrès');

      // Une recette : chaque onglet, la liste défile dans sa carte.
      await page.getByRole('link', { name: 'Semaine' }).click();
      await page.getByRole('link', { name: 'Voir la recette' }).click();
      await expect(page.getByRole('tab', { name: 'Ingrédients' })).toBeVisible();
      await expectFits(page, 'Recette, ingrédients');
      for (const tab of ['Étapes', 'Infos']) {
        await page.getByRole('tab', { name: tab }).click();
        await expectFits(page, `Recette, ${tab}`);
      }
    });
  });
}

/** L'élément, une fois amené à l'écran (défilement interne si besoin), est visible et dans la fenêtre. */
async function expectReachable(locator: ReturnType<Page['locator']>): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  // `poll` : laisse finir l'animation d'entrée de la feuille avant de mesurer.
  await expect
    .poll(
      () =>
        locator.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return r.top >= -1 && r.bottom <= window.innerHeight + 1;
        }),
      { message: 'élément hors de la fenêtre après défilement' },
    )
    .toBe(true);
}

test.describe('Texte zoomé, clavier ouvert, explication dépliée', () => {
  test('texte à 130 % : « Voir la recette » et les tuiles de Progrès restent atteignables', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('./');
    await completeOnboarding(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '130%';
    });
    await expectReachable(page.getByRole('link', { name: 'Voir la recette' }));

    await page.getByRole('link', { name: 'Progrès' }).click();
    await expect(page.getByRole('heading', { name: 'Mes progrès', level: 1 })).toBeVisible();
    await expect(page.getByRole('meter')).toHaveCount(4);
    for (const meter of await page.getByRole('meter').all()) await expectReachable(meter);
    await expectReachable(page.getByRole('button', { name: 'Noter ma mesure' }));
  });

  test('clavier ouvert (360 × 340) : Courses, Progrès et Profil gardent champ et validation à portée', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 340 });
    await page.goto('./');
    await completeOnboarding(page);

    await page.getByRole('link', { name: 'Courses' }).click();
    await page.getByRole('button', { name: 'Ajouter un article' }).click();
    const add = page.getByRole('dialog', { name: 'Ajouter un article' });
    await add.getByLabel('Article').fill('Pommes');
    await expectReachable(add.getByLabel('Article'));
    await expectReachable(add.getByRole('button', { name: 'Ajouter', exact: true }));
    await page.keyboard.press('Escape');

    await page.getByRole('link', { name: 'Progrès' }).click();
    await page.getByRole('button', { name: 'Noter ma mesure' }).click();
    const measure = page.getByRole('dialog').last();
    await measure.getByLabel('Tour de taille').fill('80');
    await expectReachable(measure.getByLabel('Tour de taille'));
    await expectReachable(measure.getByRole('button', { name: 'Enregistrer' }));
    await page.keyboard.press('Escape');

    await page.getByRole('link', { name: 'Profil' }).click();
    await page.getByRole('button', { name: 'Goûts' }).click();
    const gouts = page.getByRole('dialog', { name: 'Goûts' });
    await expectReachable(
      gouts.getByRole('button', { name: /Réponses enregistrées|Enregistrer mes réponses/ }),
    );
    await expectReachable(gouts.getByRole('button', { name: 'Fermer' }));
  });

  test('« Pourquoi ce plat ? » déplié (360 × 640) : pas de scroll de page', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('./');
    await completeOnboarding(page);
    await page.getByRole('button', { name: /Pourquoi ce plat/ }).click();
    await expect(page.getByRole('button', { name: /Pourquoi ce plat/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const fit = await measure(page);
    expect(fit.scrollHeight, JSON.stringify(fit)).toBeLessThanOrEqual(fit.innerHeight + 1);
    expect(fit.tabBarBottom, JSON.stringify(fit)).toBeLessThanOrEqual(fit.innerHeight + 1);
    await expectReachable(page.getByRole('link', { name: 'Voir la recette' }));
  });
});
