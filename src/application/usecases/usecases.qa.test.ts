/**
 * QA phase 4 — cas d'usage : régénération du menu, avis, progrès, rappel de sauvegarde,
 * courses, verrou sériel. Les tests marqués « non-régression » reproduisent un bug
 * trouvé pendant la validation.
 */
import { describe, expect, it } from 'vitest';
import { createInMemoryPorts } from '../testing';
import type { InMemoryPorts } from '../testing';
import { createUseCases } from '.';
import type { PlanResult, PlanView, ShoppingResult, ShoppingView, UseCases } from '.';
import { ALLERGENS, isRecipeCompatible } from '@domain/recipe';
import type { Allergen } from '@domain/recipe';
import type { Profile } from '@domain/profile';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';
import { dietaryFingerprint } from '@domain/userdata';

const byId = new Map(FIXTURE_RECIPES.map((r) => [r.id, r]));

function ready(result: PlanResult): PlanView {
  if (result.status !== 'ready') throw new Error('menu attendu');
  return result;
}
function list(result: ShoppingResult): ShoppingView {
  if (result.status !== 'ready') throw new Error('liste attendue');
  return result;
}
const items = (view: ShoppingView) => view.list.sections.flatMap((s) => s.items);

async function setup(
  profile: Profile = makeProfile(),
  seed = 42,
): Promise<{ ports: InMemoryPorts; uc: UseCases }> {
  const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES, seed });
  const uc = createUseCases(ports);
  await uc.saveProfile(profile);
  return { ports, uc };
}

const unsafeMeals = (view: PlanView, profile: Profile) =>
  view.plan.meals.filter((m) => {
    const recipe = byId.get(m.recipeId);
    return !recipe || !isRecipeCompatible(recipe, profile);
  });

describe('QA régénération du menu', () => {
  it.each(ALLERGENS)(
    '%s déclaré après coup : menu refait, aucun allergène, courses réinitialisées',
    async (allergen: Allergen) => {
      const { ports, uc } = await setup(makeProfile({ breakfast: true, batchCooking: true }));
      const before = ready(await uc.getCurrentPlan());
      const shopping = list(await uc.getShoppingList());
      const first = items(shopping).find((i) => !i.manual);
      if (!first) throw new Error('article attendu');
      await uc.toggleShoppingItem(first.key);
      await uc.addShoppingItem({ label: 'Café' });

      const profile = makeProfile({ breakfast: true, batchCooking: true, allergens: [allergen] });
      await uc.saveProfile(profile);
      const after = ready(await uc.getCurrentPlan());
      expect(after.origin).toBe('regenerated');
      expect(after.plan.constraintsKey).toBe(dietaryFingerprint(profile));
      expect(unsafeMeals(after, profile)).toEqual([]);
      expect(ports.state.plans.get(before.plan.weekStart)).toBe(after.plan);

      // Tous les chemins qui lisent le menu ne servent que des plats sûrs.
      for (const meal of after.plan.meals) {
        for (const alt of await uc.getMealAlternatives(meal.id)) {
          expect(alt.recipe.allergens).not.toContain(allergen);
        }
      }
      const view = list(await uc.getShoppingList());
      for (const item of items(view)) {
        for (const id of item.recipeIds) expect(byId.get(id)?.allergens).not.toContain(allergen);
      }
      expect(view.reset).toBe(true);
      expect(items(view).filter((i) => i.manual)).toHaveLength(1);
      expect(list(await uc.getShoppingList()).reset).toBe(false);
      const fridge = await uc.suggestFromFridge({ available: [] });
      if (fridge.status !== 'ready') throw new Error('suggestions attendues');
      for (const s of fridge.suggestions) expect(s.recipe.allergens).not.toContain(allergen);
      for (const r of await uc.getFavorites()) expect(r.allergens).not.toContain(allergen);
    },
  );

  it('menu stocké avec la BONNE empreinte mais un plat dangereux (import, contenu mis à jour) : refait', async () => {
    const profile = makeProfile({ allergens: ['poissons'] });
    const { ports, uc } = await setup(profile);
    const view = ready(await uc.getCurrentPlan());
    const fish = FIXTURE_RECIPES.find((r) => r.allergens.includes('poissons'));
    if (!fish) throw new Error('recette au poisson attendue');
    const [meal, ...rest] = view.plan.meals;
    if (!meal) throw new Error('repas attendu');
    ports.state.plans.set(view.plan.weekStart, {
      ...view.plan,
      meals: [{ ...meal, recipeId: fish.id }, ...rest],
    });
    const after = ready(await uc.getCurrentPlan());
    expect(after.origin).toBe('regenerated');
    expect(unsafeMeals(after, profile)).toEqual([]);
  });

  it.each<[string, Partial<Profile>]>([
    ['régime', { diets: ['vegan'] }],
    ['grossesse', { pregnantOrBreastfeeding: true }],
    ['aliment détesté', { dislikes: ['lentilles'] }],
  ])('%s : régénère', async (_label, change) => {
    const { uc } = await setup();
    ready(await uc.getCurrentPlan());
    const profile = makeProfile(change);
    await uc.saveProfile(profile);
    const after = ready(await uc.getCurrentPlan());
    expect(after.origin).toBe('regenerated');
    expect(unsafeMeals(after, profile)).toEqual([]);
  });

  it.each<[string, Partial<Profile>]>([
    ['temps', { weekdayMinutes: 15, weekendMinutes: 120 }],
    ['niveau', { weekdayLevel: 'experiment', weekendLevel: 'experiment' }],
    ['goûts', { likes: ['saumon'] }],
    ['petit-déjeuner', { breakfast: true }],
  ])('%s : pas de régénération automatique', async (_label, change) => {
    const { uc } = await setup();
    const before = ready(await uc.getCurrentPlan());
    await uc.saveProfile(makeProfile(change));
    const after = ready(await uc.getCurrentPlan());
    expect(after.origin).toBe('stored');
    expect(after.plan).toEqual(before.plan);
  });

  it('change de semaine au lundi (jour local de Clock.today)', async () => {
    const { ports, uc } = await setup();
    ports.clock.set('2026-11-29T23:59:00.000Z'); // dimanche
    expect(ready(await uc.getCurrentPlan()).plan.weekStart).toBe('2026-11-23');
    ports.clock.set('2026-11-30T00:00:00.000Z'); // lundi
    const next = ready(await uc.getCurrentPlan());
    expect(next.plan.weekStart).toBe('2026-11-30');
    expect(next.origin).toBe('generated');
  });
});

describe('QA avis', () => {
  it('un avis par repas, remplacé ; restes → plat source ; suppression', async () => {
    // Première graine qui produit un repas de restes.
    let found;
    for (let seed = 1; seed < 100 && !found; seed += 1) {
      const candidate = await setup(makeProfile(), seed);
      const plan = ready(await candidate.uc.getCurrentPlan()).plan;
      const meal = plan.meals.find((m) => m.isLeftover && m.leftoverOf);
      if (meal) found = { ...candidate, plan, leftover: meal };
    }
    if (!found?.leftover.leftoverOf) throw new Error('restes attendus');
    const { ports, uc, plan, leftover } = found;
    const { weekStart } = plan;
    if (!leftover.leftoverOf) throw new Error('restes attendus');
    await uc.rateMeal({ weekStart, mealId: leftover.leftoverOf, verdict: 'up' });
    const viaLeftover = await uc.rateMeal({
      weekStart,
      mealId: leftover.id,
      verdict: 'down',
      reason: 'trop-copieux',
    });
    expect(viaLeftover?.mealId).toBe(leftover.leftoverOf);
    expect(ports.state.ratings.size).toBe(1);
    const shown = ready(await uc.getCurrentPlan()).ratings;
    expect(shown[leftover.id]?.verdict).toBe('down');
    expect(shown[leftover.leftoverOf]?.verdict).toBe('down');

    await uc.removeRating(viaLeftover?.id ?? '');
    expect(ports.state.ratings.size).toBe(0);
    expect(ready(await uc.getCurrentPlan()).ratings).toEqual({});
  });

  it('non-régression : un 👎 « pas aimé » survit au remplacement du repas puis à un nouvel avis', async () => {
    const { ports, uc } = await setup();
    const view = ready(await uc.getCurrentPlan());
    const { weekStart } = view.plan;
    const meal = view.plan.meals.find((m) => !m.isLeftover);
    if (!meal) throw new Error('repas attendu');
    const disliked = meal.recipeId;
    await uc.rateMeal({ weekStart, mealId: meal.id, verdict: 'down', reason: 'pas-aime' });
    const [alt] = await uc.getMealAlternatives(meal.id);
    if (!alt) throw new Error('alternative attendue');
    await uc.replaceMeal({ mealId: meal.id, recipeId: alt.recipe.id });
    ports.clock.set('2026-11-23T12:00:00.000Z');
    const rating = await uc.rateMeal({ weekStart, mealId: meal.id, verdict: 'up' });

    const all = [...ports.state.ratings.values()];
    expect(all.map((r) => [r.recipeId, r.verdict]).sort()).toEqual(
      [
        [alt.recipe.id, 'up'],
        [disliked, 'down'],
      ].sort(),
    );
    // L'ancien avis n'est plus rattaché au repas : seul le nouveau s'affiche.
    expect(ready(await uc.getCurrentPlan()).ratings[meal.id]?.id).toBe(rating?.id);
    // … mais il compte toujours : le plat n'est plus proposé la semaine suivante.
    ports.clock.set('2026-11-30T10:00:00.000Z');
    const next = ready(await uc.getCurrentPlan());
    expect(next.plan.meals.map((m) => m.recipeId)).not.toContain(disliked);
  });

  it('non-régression : « Nouveau menu » ne fait pas perdre les avis de l’ancien', async () => {
    const { ports, uc } = await setup();
    const rated = new Set<string>();
    let view = ready(await uc.getCurrentPlan());
    const { weekStart } = view.plan;
    for (let round = 0; round < 3; round += 1) {
      for (const m of view.plan.meals.filter((x) => !x.isLeftover)) {
        await uc.rateMeal({ weekStart, mealId: m.id, verdict: 'up' });
        rated.add(m.recipeId);
      }
      view = ready(await uc.generateWeeklyPlan());
    }
    const kept = new Set([...ports.state.ratings.values()].map((r) => r.recipeId));
    expect([...rated].filter((id) => !kept.has(id))).toEqual([]);
  });

  it('un 👎 « pas aimé » écarte le plat du menu suivant ; le retirer le rend possible', async () => {
    const { ports, uc } = await setup();
    const view = ready(await uc.getCurrentPlan());
    const { weekStart } = view.plan;
    const cooked = view.plan.meals.filter((m) => !m.isLeftover);
    const ratings = [];
    for (const m of cooked) {
      ratings.push(
        await uc.rateMeal({ weekStart, mealId: m.id, verdict: 'down', reason: 'pas-aime' }),
      );
    }
    const disliked = new Set(cooked.map((m) => m.recipeId));
    const next = ready(await uc.generateWeeklyPlan());
    const repeated = next.plan.meals.filter((m) => disliked.has(m.recipeId) && !m.isLeftover);
    // Les plats évités ne reviennent que faute d'alternative (contrainte assouplie).
    for (const m of repeated) expect(m.relaxed).toContain('evitee');
    for (const r of ratings) await uc.removeRating(r?.id ?? '');
    expect(ports.state.ratings.size).toBe(0);
  });
});

describe('QA progrès', () => {
  it('une mesure par semaine lundi → dimanche', async () => {
    const { ports, uc } = await setup();
    ports.clock.set('2026-11-29T20:00:00.000Z'); // dimanche
    await expect(uc.logProgress({ weightKg: 62 })).resolves.toEqual({ status: 'created' });
    ports.clock.set('2026-11-30T08:00:00.000Z'); // lundi suivant
    await expect(uc.logProgress({ weightKg: 61.8 })).resolves.toEqual({ status: 'created' });
    await expect(uc.logProgress({ date: '2026-12-01', weightKg: 61 })).resolves.toMatchObject({
      status: 'invalide',
    });
    // Rattrapage dans la semaine précédente : complète le point du dimanche.
    await expect(uc.logProgress({ date: '2026-11-25', waistCm: 70 })).resolves.toEqual({
      status: 'updated',
    });
    expect([...ports.state.progress.values()].sort((a, b) => a.date.localeCompare(b.date))).toEqual(
      [
        { date: '2026-11-29', weightKg: 62, waistCm: 70 },
        { date: '2026-11-30', weightKg: 61.8 },
      ],
    );
  });

  it('fusion : un autre jour de la semaine complète et corrige, une seule mesure gardée', async () => {
    const { ports, uc } = await setup();
    await uc.logProgress({ weightKg: 62, waistCm: 75 }); // lundi 23
    ports.clock.set('2026-11-26T08:00:00.000Z');
    await expect(uc.logProgress({ waistCm: 74 })).resolves.toEqual({ status: 'updated' });
    expect([...ports.state.progress.values()]).toEqual([
      { date: '2026-11-26', weightKg: 62, waistCm: 74 },
    ]);
  });

  it('non-régression : suivi désactivé, la saisie du tour de taille complète la semaine au poids caché', async () => {
    const { ports, uc } = await setup();
    await uc.logProgress({ weightKg: 62 }); // lundi 23
    await uc.setWeightTracking(false);
    ports.clock.set('2026-11-25T10:00:00.000Z');
    await expect(uc.logProgress({ waistCm: 70 })).resolves.toEqual({ status: 'updated' });
    expect([...ports.state.progress.values()]).toEqual([
      { date: '2026-11-25', weightKg: 62, waistCm: 70 },
    ]);
    expect((await uc.getProgressSummary()).entries).toEqual([{ date: '2026-11-25', waistCm: 70 }]);
  });

  it.each<[string, Partial<Profile>]>([
    ['mineur', { age: 16 }],
    ['condition de santé', { healthCondition: true }],
  ])('%s : suivi du poids désactivé par défaut, poids refusé et masqué', async (_l, change) => {
    const { ports, uc } = await setup(makeProfile(change));
    const status = await uc.getProgressSummary();
    expect(status.weightTracking).toEqual({ enabled: false, enabledByDefault: false });
    await expect(uc.logProgress({ weightKg: 50 })).resolves.toMatchObject({ status: 'invalide' });
    expect(ports.state.progress.size).toBe(0);
    ports.state.progress.set('2026-11-16', { date: '2026-11-16', weightKg: 50, waistCm: 70 });
    const view = await uc.getProgressSummary();
    expect(view.entries).toEqual([{ date: '2026-11-16', waistCm: 70 }]);
    expect(view.weightTrend).toEqual([]);
    expect(JSON.stringify(view)).not.toContain('"weightKg"');
  });

  it('adulte : suivi activé par défaut, désactivable', async () => {
    const { uc } = await setup();
    expect((await uc.getProgressSummary()).weightTracking.enabled).toBe(true);
    await uc.setWeightTracking(false);
    await expect(uc.logProgress({ weightKg: 60 })).resolves.toMatchObject({ status: 'invalide' });
  });
});

describe('QA rappel de sauvegarde', () => {
  it('jamais sans profil, même très longtemps après', async () => {
    const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES });
    const uc = createUseCases(ports);
    ports.state.settings = { theme: 'system', profileCreatedAt: '2020-01-01T00:00:00.000Z' };
    await expect(uc.getBackupReminder()).resolves.toMatchObject({ due: false });
  });

  it('29 jours non, 30 jours oui, visible le jour même, muet le lendemain et 29 jours', async () => {
    const { ports, uc } = await setup(); // onboarding le 2026-11-23
    ports.clock.set('2026-12-22T10:00:00.000Z');
    expect((await uc.getBackupReminder()).due).toBe(false);
    ports.clock.set('2026-12-23T10:00:00.000Z');
    expect((await uc.getBackupReminder()).due).toBe(true);
    expect((await uc.getBackupReminder()).due).toBe(true);
    ports.clock.set('2026-12-24T10:00:00.000Z');
    expect((await uc.getBackupReminder()).due).toBe(false);
    ports.clock.set('2027-01-21T10:00:00.000Z');
    expect((await uc.getBackupReminder()).due).toBe(false);
    ports.clock.set('2027-01-22T10:00:00.000Z');
    expect((await uc.getBackupReminder()).due).toBe(true);
    await uc.exportData();
    ports.clock.set('2027-01-23T10:00:00.000Z');
    expect((await uc.getBackupReminder()).due).toBe(false);
  });

  it('après « Tout effacer » : plus de rappel', async () => {
    const { ports, uc } = await setup();
    await uc.wipeAllData();
    ports.clock.set('2027-06-01T10:00:00.000Z');
    expect((await uc.getBackupReminder()).due).toBe(false);
  });
});

describe('QA courses', () => {
  it('foyer ou facteur de portion modifiés : coches remises à zéro une seule fois', async () => {
    const { uc } = await setup();
    const first = items(list(await uc.getShoppingList())).find((i) => !i.manual);
    if (!first) throw new Error('article attendu');
    await uc.toggleShoppingItem(first.key);
    await uc.saveProfile(makeProfile({ householdSize: 4 }));
    const view = list(await uc.getShoppingList());
    expect(view.reset).toBe(true);
    expect(items(view).some((i) => i.checked)).toBe(false);
    expect(list(await uc.getShoppingList()).reset).toBe(false);

    // Facteur de portion : un avis « trop copieux » le réduit.
    await uc.toggleShoppingItem(first.key);
    const plan = ready(await uc.getCurrentPlan()).plan;
    const meal = plan.meals.find((m) => !m.isLeftover);
    await uc.rateMeal({
      weekStart: plan.weekStart,
      mealId: meal?.id ?? '',
      verdict: 'down',
      reason: 'trop-copieux',
    });
    expect(list(await uc.getShoppingList()).reset).toBe(true);
  });

  it('non-régression : seul un article manuel coché ⇒ pas de « reset » annoncé', async () => {
    const { uc } = await setup();
    const added = list(await uc.addShoppingItem({ label: 'Café' }));
    const coffee = items(added).find((i) => i.manual);
    if (!coffee) throw new Error('article manuel attendu');
    await uc.toggleShoppingItem(coffee.key);
    await uc.saveProfile(makeProfile({ householdSize: 3 }));
    const view = list(await uc.getShoppingList());
    expect(view.reset).toBe(false);
    expect(items(view).find((i) => i.key === coffee.key)?.checked).toBe(true);
  });

  it('verrou sériel : écritures simultanées toutes conservées', async () => {
    const { ports, uc } = await setup();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => uc.addShoppingItem({ label: `Article ${i}` })),
    );
    const record = [...ports.state.shopping.values()][0];
    expect(record?.state.manualItems).toHaveLength(10);
    expect(new Set(record?.state.manualItems.map((m) => m.id)).size).toBe(10);
  });
});

describe('QA import (application)', () => {
  it('non-régression : persistenceGranted d’un autre appareil n’est jamais importé', async () => {
    const a = createInMemoryPorts({ recipes: FIXTURE_RECIPES });
    const ua = createUseCases(a);
    await ua.saveProfile(makeProfile());
    await ua.requestPersistentStorage();
    await ua.exportData();
    const content = a.fileSaver.files[0]?.content ?? '';
    expect(content).toContain('"persistenceGranted": true');

    const b = createInMemoryPorts({ recipes: FIXTURE_RECIPES, grantPersistence: false });
    const ub = createUseCases(b);
    await expect(ub.importData({ content })).resolves.toMatchObject({ status: 'imported' });
    expect(b.state.settings).not.toHaveProperty('persistenceGranted');

    await ub.requestPersistentStorage();
    await ub.importData({ content });
    expect(b.state.settings.persistenceGranted).toBe(false);
  });

  it('import refusé (phrase, version, JSON) : aucune écriture', async () => {
    const { ports, uc } = await setup();
    await uc.exportData({ passphrase: 'phrase-longue' });
    const before = JSON.stringify(await ports.userData.exportAll());
    const encrypted = ports.fileSaver.files[0]?.content ?? '';
    for (const input of [
      { content: encrypted },
      { content: encrypted, passphrase: 'mauvaise-phrase' },
      { content: '{"app":"nutry","schemaVersion":99}' },
      { content: '{"app":"nutry"' },
      { content: 'x'.repeat(5_000_001) },
    ]) {
      const result = await uc.importData(input);
      expect(result.status).not.toBe('imported');
    }
    expect(JSON.stringify(await ports.userData.exportAll())).toBe(before);
  });

  it('export : phrase trop courte refusée, rien n’est écrit', async () => {
    const { ports, uc } = await setup();
    for (const passphrase of ['', '1234567']) {
      await expect(uc.exportData({ passphrase })).resolves.toMatchObject({
        status: 'passphrase-too-short',
      });
    }
    expect(ports.fileSaver.files).toEqual([]);
    expect(ports.state.settings.lastBackupAt).toBeUndefined();
  });
});
