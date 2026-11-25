/// <reference lib="dom" />
// Les callbacks de page.evaluate s’exécutent dans le navigateur : types DOM requis.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  completeOnboarding,
  completeSportOnboarding,
  dismissQuiz,
  openSportSession,
  pickSportDay,
  toFirstExercise,
} from './helpers';

/**
 * Règle de mise en page : chaque écran principal tient dans la hauteur de l'écran, sans
 * défilement de la page (seules les listes défilent, à l'intérieur de leur carte).
 * Mesuré du petit téléphone à l'ordinateur : 360 × 640, iPhone SE et 15, Pixel 7, iPad en
 * portrait et en paysage, 1440 × 900. Aucun débordement, rien de coupé, barre d'onglets (ou rail
 * latéral sur grand écran) toujours visible.
 */
const VIEWPORTS = [
  { name: '360 × 640', size: { width: 360, height: 640 }, rail: false },
  { name: 'iPhone SE (375 × 667)', size: { width: 375, height: 667 }, rail: false },
  { name: 'iPhone 15 (393 × 852)', size: { width: 393, height: 852 }, rail: false },
  { name: 'Pixel 7', size: undefined, rail: false },
  { name: 'iPad portrait (820 × 1180)', size: { width: 820, height: 1180 }, rail: true },
  { name: 'iPad paysage (1180 × 820)', size: { width: 1180, height: 820 }, rail: true },
  { name: 'ordinateur (1440 × 900)', size: { width: 1440, height: 900 }, rail: true },
] as const;

interface Fit {
  readonly scrollHeight: number;
  readonly innerHeight: number;
  /** Débordement du contenu de `<main>` (contenu coupé ou poussé hors de sa zone). */
  readonly mainOverflow: number;
  /** Bas de la barre d'onglets : doit rester dans l'écran. */
  readonly tabBarBottom: number;
  /** Navigation entièrement dans la fenêtre. */
  readonly navInside: boolean;
  /** Débordement horizontal de la page ou de `<main>`. */
  readonly overflowX: number;
  /** Hauteur libre sous le contenu de `<main>` (marge de sécurité des polices). */
  readonly spare: number;
}

async function measure(page: Page): Promise<Fit> {
  // Les animations d'entrée (glissement de la carte) décalent un instant le contenu : on les laisse finir.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        // Une animation annulée (élément retiré) rejette sa promesse : sans importance ici.
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  return page.evaluate(() => {
    const main = document.querySelector('main');
    const tabBar = document.querySelector('nav[aria-label="Navigation principale"]');
    // Le pied de page collé en bas (`margin-top: auto`) fausserait la mesure de la réserve.
    document.querySelectorAll<HTMLElement>('[role="note"]').forEach((el) => {
      el.style.marginTop = '0';
    });
    const mainRect = main?.getBoundingClientRect();
    let lowest = 0;
    // Seules les feuilles de l'arbre comptent : les conteneurs s'étirent jusqu'en bas.
    main?.querySelectorAll('*').forEach((el) => {
      if (el.childElementCount > 0) return;
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.width > 0) lowest = Math.max(lowest, r.bottom);
    });
    const navRect = tabBar?.getBoundingClientRect();
    return {
      scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
      innerHeight: window.innerHeight,
      mainOverflow: main ? main.scrollHeight - main.clientHeight : 0,
      tabBarBottom: navRect ? navRect.bottom : 0,
      // Pas de navigation pendant l'accueil : rien à vérifier.
      navInside:
        !navRect ||
        (navRect.width > 0 &&
          navRect.left >= -1 &&
          navRect.right <= window.innerWidth + 1 &&
          navRect.top >= -1 &&
          navRect.bottom <= window.innerHeight + 1),
      overflowX: Math.max(
        (document.scrollingElement?.scrollWidth ?? 0) - window.innerWidth,
        main ? main.scrollWidth - main.clientWidth : 0,
      ),
      spare: mainRect ? Math.round(mainRect.bottom - lowest) : 0,
    };
  });
}

async function expectFits(page: Page, label: string): Promise<Fit> {
  const fit = await measure(page);
  const where = `${label} : ${JSON.stringify(fit)}`;
  expect(fit.scrollHeight, `défilement de la page, ${where}`).toBeLessThanOrEqual(
    fit.innerHeight + 1,
  );
  expect(fit.mainOverflow, `contenu qui déborde de la coque, ${where}`).toBeLessThanOrEqual(1);
  expect(fit.tabBarBottom, `barre d'onglets, ${where}`).toBeLessThanOrEqual(fit.innerHeight + 1);
  expect(fit.navInside, `navigation hors de la fenêtre, ${where}`).toBe(true);
  expect(fit.overflowX, `débordement horizontal, ${where}`).toBeLessThanOrEqual(1);
  return fit;
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    if (viewport.size) test.use({ viewport: viewport.size });

    test('Semaine, Courses, Moi et Recette tiennent sans scroll de page', async ({ page }) => {
      await page.goto('./');
      await expectFits(page, 'onboarding, étape 1');
      await completeOnboarding(page);

      // Semaine : le repas du jour, puis chaque jour du bandeau (illustration et titres variés).
      await expect(page.getByTestId('meal').first()).toBeVisible();
      await expectFits(page, 'Semaine');
      const days = page.getByRole('tablist', { name: 'Jours de la semaine' }).getByRole('tab');
      for (let i = 0; i < (await days.count()); i += 1) {
        await days.nth(i).click();
        await expect(days.nth(i)).toHaveAttribute('aria-selected', 'true');
        await expectFits(page, `Semaine, jour ${i + 1}`);
      }
      // Téléphone : onglets repas ; tablette et ordinateur : les repas du jour sont ensemble.
      if (!viewport.rail) {
        await page.getByRole('tab', { name: 'Dîner' }).click();
        await expectFits(page, 'Semaine, dîner');
      }

      await page.getByRole('link', { name: 'Courses' }).click();
      await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
      await expectFits(page, 'Courses');
      const rayons = page.getByRole('tablist', { name: 'Rayons' }).getByRole('tab');
      await rayons.nth(1).click();
      await expectFits(page, 'Courses, 2e rayon');

      // Moi : Nutry, série et progrès en cartes, réglages dans le ⚙.
      await page.getByRole('link', { name: 'Moi' }).click();
      await expect(page.getByRole('heading', { name: 'Moi', level: 1 })).toBeVisible();
      await expect(page.getByRole('img', { name: /^Nutry, la petite boule/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Noter ma mesure' })).toBeVisible();
      await expect(page.getByRole('note')).toContainText('ne remplace pas');
      const moi = await expectFits(page, 'Moi');
      if (viewport.size?.height === 640) {
        expect(moi.spare, `réserve sous Moi : ${JSON.stringify(moi)}`).toBeGreaterThanOrEqual(10);
      }

      // Crédits photos : la longue liste défile dans sa carte, jamais la page.
      await page.getByRole('link', { name: 'Moi' }).click();
      await page.getByRole('button', { name: 'Réglages' }).click();
      await page
        .getByRole('dialog', { name: 'Réglages' })
        .getByRole('button', { name: 'Confidentialité' })
        .click();
      await page
        .getByRole('dialog', { name: 'Confidentialité' })
        .getByRole('link', { name: 'Crédits photos' })
        .click();
      await expect(page.getByRole('heading', { name: 'Crédits photos', level: 1 })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Liste des crédits photos' })).toBeVisible();
      await expectFits(page, 'Crédits photos');

      // Une recette : chaque onglet, la liste défile dans sa carte.
      await page.getByRole('link', { name: 'Semaine' }).click();
      await page.getByTestId('meal').getByRole('link').first().click();
      await expect(page.getByRole('tab', { name: 'Ingrédients' })).toBeVisible();
      await expectFits(page, 'Recette, ingrédients');
      for (const tab of ['Étapes', 'Infos']) {
        await page.getByRole('tab', { name: tab }).click();
        await expectFits(page, `Recette, ${tab}`);
      }
    });
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(`Sport, ${viewport.name}`, () => {
    if (viewport.size) test.use({ viewport: viewport.size });

    test('onboarding Sport, semaine, séance, minuteur, tuto et feuilles tiennent sans scroll de page', async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.goto('./');
      await completeOnboarding(page);
      await dismissQuiz(page);
      await completeSportOnboarding(page, async (screen) => {
        await expectFits(page, `onboarding Sport, écran ${screen}`);
        if (screen > 0) {
          await expectReachable(page.getByRole('heading', { level: 1 }));
          await expectReachable(
            page.getByRole('button', { name: /Continuer|Créer mon programme|J’ai compris/ }),
          );
        }
      });

      await expectFits(page, 'Sport');
      await pickSportDay(page, false);
      await expectFits(page, 'Sport, jour de repos');
      await pickSportDay(page, true);
      await expect(page.getByTestId('sport-session')).toBeVisible();
      await expectFits(page, 'Sport, jour de séance');
      await expectReachable(page.getByRole('button', { name: 'Commencer la séance' }));

      for (const name of ['Mes séances', 'Plus d’options']) {
        await page.getByRole('button', { name }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expectFits(page, `Sport, feuille ${name}`);
        await page.keyboard.press('Escape');
      }

      await openSportSession(page);
      await expectFits(page, 'Séance, échauffement');
      await toFirstExercise(page);
      const fit = await expectFits(page, 'Séance, exercice');
      expect(fit.spare, `réserve sous la séance : ${JSON.stringify(fit)}`).toBeGreaterThanOrEqual(
        0,
      );
      for (const name of [/Valider la série/, 'Exercice suivant', 'Ça fait mal', 'Voir le tuto']) {
        await expectReachable(page.getByRole('button', { name }).first());
      }
      // Le mannequin garde une taille confortable.
      const figure = await page.locator('main [data-figure]').first().boundingBox();
      expect(figure?.height ?? 0, 'hauteur du mannequin').toBeGreaterThanOrEqual(110);

      await page.getByRole('button', { name: /Valider la série/ }).click();
      await expect(page.getByRole('region', { name: 'Repos' })).toBeVisible();
      await expectFits(page, 'Séance, repos');
      await page.getByRole('button', { name: 'Passer' }).click();

      await page.getByRole('button', { name: 'Voir le tuto' }).click();
      const tuto = page.getByRole('dialog', { name: /^Tuto/ });
      await expect(tuto.getByRole('heading', { name: 'Comment faire' })).toBeVisible();
      await expectFits(page, 'Tuto');
      await expectReachable(tuto.getByRole('button', { name: 'Fermer le tuto' }));
      await expectReachable(tuto.getByRole('link', { name: /^Voir une vidéo/ }));
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Remplacer' }).click();
      await expect(page.getByRole('dialog', { name: 'Remplacer l’exercice' })).toBeVisible();
      await expectFits(page, 'Séance, remplacer');
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Quitter la séance' }).click();
      await page.getByRole('button', { name: 'Terminer maintenant' }).click();
      await page.getByRole('button', { name: 'Terminer la séance' }).click();
      await expect(page.getByRole('heading', { name: /Bravo/ })).toBeVisible();
      await expectFits(page, 'Fin de séance');
      await expectReachable(page.getByRole('link', { name: 'Retour à ma semaine' }));

      await page.goto('./#/credits-exercices');
      await expect(
        page.getByRole('heading', { name: 'Crédits exercices', level: 1 }),
      ).toBeVisible();
      await expectFits(page, 'Crédits exercices');
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

test.describe('Onboarding : les neuf écrans', () => {
  for (const size of [
    { width: 360, height: 640 },
    { width: 360, height: 340 },
    { width: 1440, height: 900 },
  ]) {
    test(`aucun scroll de page à ${size.width} × ${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('./');
      let seen = 0;
      await completeOnboarding(page, async (screen) => {
        seen = screen;
        const fit = await measure(page);
        const where = `écran ${screen} : ${JSON.stringify(fit)}`;
        expect(fit.scrollHeight, `défilement de la page, ${where}`).toBeLessThanOrEqual(
          fit.innerHeight + 1,
        );
        expect(fit.overflowX, `débordement horizontal, ${where}`).toBeLessThanOrEqual(1);
        // Le titre, la réponse et les boutons restent à l'écran (le milieu défile à l'intérieur).
        await expectReachable(page.getByRole('heading', { level: 1 }));
        await expectReachable(
          page.getByRole('button', { name: /Continuer|Passer|Voir mon menu/ }).last(),
        );
      });
      expect(seen).toBe(9);
    });
  }
});

test.describe('Texte zoomé, clavier ouvert, explication dépliée', () => {
  test('texte à 130 % : la carte du repas, ses actions et les cartes de Moi restent atteignables', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('./');
    await completeOnboarding(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '130%';
    });
    await expectReachable(page.getByTestId('meal').getByRole('link').first());
    await expectReachable(page.getByRole('button', { name: 'J’ai aimé' }));

    await page.getByRole('link', { name: 'Moi' }).click();
    await expect(page.getByRole('heading', { name: 'Moi', level: 1 })).toBeVisible();
    for (const name of [/équilibre/i, /Favoris/, /Historique/]) {
      await expectReachable(page.getByRole('button', { name }));
    }
    await expectReachable(page.getByRole('button', { name: 'Noter ma mesure' }));
  });

  test('clavier ouvert (360 × 340) : Courses, Moi et les réglages gardent champ et validation à portée', async ({
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

    await page.getByRole('link', { name: 'Moi' }).click();
    await page.getByRole('button', { name: 'Noter ma mesure' }).click();
    const measure = page.getByRole('dialog').last();
    await measure.getByLabel('Tour de taille').fill('80');
    await expectReachable(measure.getByLabel('Tour de taille'));
    await expectReachable(measure.getByRole('button', { name: 'Enregistrer' }));
    await page.keyboard.press('Escape');

    await page.getByRole('link', { name: 'Moi' }).click();
    await page.getByRole('button', { name: 'Réglages' }).click();
    await page
      .getByRole('dialog', { name: 'Réglages' })
      .getByRole('button', { name: 'Goûts' })
      .click();
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
    await expectReachable(page.getByTestId('meal').getByRole('link').first());
  });
});
