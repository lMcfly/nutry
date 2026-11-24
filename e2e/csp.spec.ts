import { completeOnboarding, dismissQuiz } from './helpers';
import { UNSPLASH_HOST, expect, test } from './fixtures';

const EXPECTED_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://images.unsplash.com; " +
  "connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; " +
  "base-uri 'self'; form-action 'none'";

test.describe('Content Security Policy', () => {
  test('la page servie porte la CSP attendue, sans script en ligne', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
      'content',
      EXPECTED_CSP,
    );
    const inlineScripts = await page.locator('script:not([src])').count();
    expect(inlineScripts).toBe(0);
  });

  test('aucune violation sur tous les écrans, import de sauvegarde compris', async ({ page }) => {
    await page.goto('./');
    await completeOnboarding(page);
    await expect(page.getByTestId('meal')).toHaveCount(1);
    // Fiche recette (catalogue validé par Zod, chargé à la demande).
    await page.getByTestId('meal').first().getByRole('link').first().click();
    await expect(page).toHaveURL(/#\/recette\//);

    for (const route of [
      'courses',
      'frigo',
      'progres',
      'confidentialite',
      'credits-photos',
      'profil',
    ]) {
      await page.goto(`./#/${route}`);
      await dismissQuiz(page);
      await expect(page.locator('main')).toBeVisible();
    }

    // « Mes données » : la feuille plein écran du Profil.
    await page.goto('./#/profil');
    await dismissQuiz(page);
    await page.getByRole('button', { name: 'Mes données' }).click();
    await expect(page.getByRole('dialog', { name: 'Mes données' })).toBeVisible();

    // Import d'une sauvegarde invalide : le schéma Zod de sauvegarde s'exécute.
    await page.getByLabel('Choisir une sauvegarde à importer').setInputFiles({
      name: 'sauvegarde.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ app: 'nutry', schemaVersion: 1, plans: 'x' })),
    });
    const dialog = page.getByRole('alertdialog', { name: 'Remplacer toutes tes données ?' });
    await dialog.getByRole('button', { name: 'Oui, remplacer' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await dialog.getByRole('button', { name: 'Annuler' }).click();

    // Service worker actif : le précache s'est fait sous la CSP.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
  });

  test('les photos Unsplash passent la CSP et le service worker les met en cache', async ({
    page,
  }) => {
    await page.goto('./');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Le service worker contrôle la page après un rechargement (clientsClaim).
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);
    const loaded = await page.evaluate(
      (url) =>
        new Promise<boolean>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            resolve(true);
          };
          img.onerror = () => {
            resolve(false);
          };
          img.srcset = `${url}&w=400 400w`;
          img.src = `${url}&w=800`;
          document.body.append(img);
        }),
      `${UNSPLASH_HOST}/photo-test?ixid=x`,
    );
    expect(loaded).toBe(true);
    // CacheFirst sous la CSP de la page : aucune violation, aucune connect-src nécessaire.
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const cache = await caches.open('nutry-photos-unsplash');
            return (await cache.keys()).length;
          }),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);
  });

  test('une image d’un autre hôte reste bloquée (témoin img-src)', async ({
    page,
    cspViolations,
  }) => {
    await page.goto('./');
    await expect(page.locator('#root')).not.toBeEmpty();
    await page.evaluate(() => {
      const img = new Image();
      img.src = 'https://example.com/photo.png';
      document.body.append(img);
    });
    // L'événement (img-src) et le message de console arrivent séparément : on attend les deux.
    await expect
      .poll(() => new Set(cspViolations.map((v) => v.directive)).size)
      .toBeGreaterThanOrEqual(2);
    expect(cspViolations.some((v) => v.directive === 'img-src')).toBe(true);
    cspViolations.length = 0;
  });

  test('le garde-fou détecte bien une violation (témoin)', async ({ page, cspViolations }) => {
    await page.goto('./');
    await expect(page.locator('#root')).not.toBeEmpty();
    // Un script en ligne injecté doit être bloqué ET signalé.
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__nutryInline = true;';
      document.body.append(script);
    });
    await expect.poll(() => cspViolations.length).toBeGreaterThan(0);
    expect(await page.evaluate(() => 'nutryInline' in window)).toBe(false);
    expect(cspViolations.some((v) => v.directive.startsWith('script-src'))).toBe(true);
    // Témoin réussi : on vide la liste pour que le contrôle automatique reste vert.
    cspViolations.length = 0;
  });
});
