import { describe, expect, it } from 'vitest';
import { FixedClock, createInMemoryPorts } from '../testing';
import { createUseCases } from '.';
import type { ShoppingResult } from '.';
import { COMPANION_MESSAGES, DEFAULT_LOOK, INITIAL_COMPANION_STATE } from '@domain/companion';
import type { CompanionLook } from '@domain/companion';
import type { QuizQuestion } from '@domain/quiz';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';

const QUESTIONS: QuizQuestion[] = ['q1', 'q2', 'q3', 'q4', 'q5'].map((id) => ({
  id,
  question: `Question ${id} ?`,
  choices: ['A', 'B', 'C', 'D'],
  correctIndex: 1,
  explanation: `Parce que ${id}.`,
  category: 'histoire',
  difficulty: 'facile',
}));

const setup = async () => {
  const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES, questions: QUESTIONS });
  const uc = createUseCases(ports);
  await uc.saveProfile(makeProfile());
  return { ports, uc };
};
type Env = Awaited<ReturnType<typeof setup>>;

const nextDay = (ports: Env['ports']) => {
  const date = new Date(ports.clock.now().getTime() + 86_400_000);
  ports.clock.set(date.toISOString());
  ports.device.values.session.clear();
};

/** Répond au quiz (un geste). */
async function answer({ uc }: Env): Promise<void> {
  const quiz = await uc.getQuiz();
  await uc.answerQuiz({ questionId: quiz?.questionId ?? '', answerIndex: 1 });
}

async function firstMeal({ uc }: Env) {
  const view = await uc.getCurrentPlan();
  if (view.status !== 'ready') throw new Error('menu attendu');
  const meal = view.plan.meals[0];
  if (!meal) throw new Error('repas attendu');
  return { weekStart: view.plan.weekStart, mealId: meal.id };
}

const firstKey = (result: ShoppingResult): string => {
  if (result.status !== 'ready') throw new Error('liste attendue');
  const key = result.list.sections.flatMap((s) => s.items)[0]?.key;
  if (!key) throw new Error('article attendu');
  return key;
};

describe('getCompanion', () => {
  it('accueille une personne qui n’a encore rien fait', async () => {
    const { uc } = await setup();
    const view = await uc.getCompanion();
    expect(view).toMatchObject({
      look: DEFAULT_LOOK,
      mood: 'content',
      message: COMPANION_MESSAGES.welcome,
      streak: 0,
      best: 0,
      newlyUnlocked: [],
      nextUnlock: { item: { id: 'feuille' }, inDays: 1 },
    });
    expect(view.unlocked).toHaveLength(11);
  });

  it('un geste : humeur joyeuse, première feuille signalée', async () => {
    const env = await setup();
    await answer(env);
    const view = await env.uc.getCompanion();
    expect(view).toMatchObject({ mood: 'joyeux', streak: 1, best: 1 });
    expect(view.newlyUnlocked.map((i) => i.id)).toEqual(['feuille']);
    expect(view.nextUnlock).toMatchObject({ item: { id: 'lunettes-rondes' }, inDays: 2 });
  });

  it('jour manqué : sieste, série à 0, record et déblocages gardés', async () => {
    const env = await setup();
    for (let i = 0; i < 3; i += 1) {
      await answer(env);
      nextDay(env.ports);
    }
    nextDay(env.ports);
    const view = await env.uc.getCompanion();
    expect(view).toMatchObject({ mood: 'sieste', streak: 0, best: 3 });
    expect(view.message).toContain('record de 3 jours');
    expect(view.unlocked.map((i) => i.id)).toContain('lunettes-rondes');
    expect(view.nextUnlock).toMatchObject({ item: { id: 'aurore' }, inDays: 5 });
    // Le geste suivant repart à 1, sans rien reperdre.
    await answer(env);
    expect(await env.uc.getCompanion()).toMatchObject({ mood: 'joyeux', streak: 1, best: 3 });
  });
});

describe('enregistrement d’activité', () => {
  it('répondre au quiz compte ; rejouer la réponse ou répondre hors session ne compte pas', async () => {
    const env = await setup();
    const quiz = await env.uc.getQuiz();
    await env.uc.answerQuiz({ questionId: quiz?.questionId ?? '', answerIndex: 1 });
    const stored = env.ports.state.companion;
    // Rejouer la même question dans la session : réponse déjà donnée, rien ne change.
    await env.uc.answerQuiz({ questionId: quiz?.questionId ?? '', answerIndex: 0 });
    expect(env.ports.state.companion).toBe(stored);
    await env.uc.answerQuiz({ questionId: 'inconnue', answerIndex: 0 });
    expect(env.ports.state.companion).toBe(stored);
    expect(stored).toMatchObject({ streak: 1, lastActiveDay: '2026-11-23' });
  });

  it('ouvrir l’app, consulter le quiz, le menu ou la liste ne compte pas', async () => {
    const env = await setup();
    await env.uc.getQuiz();
    await env.uc.getCurrentPlan();
    await env.uc.getShoppingList();
    await env.uc.getCompanion();
    expect(env.ports.state.companion).toEqual(INITIAL_COMPANION_STATE);
  });

  it('noter un repas compte (👍 comme 👎, et re-noter le même jour est sans effet)', async () => {
    const env = await setup();
    const meal = await firstMeal(env);
    await env.uc.rateMeal({ ...meal, verdict: 'down' });
    await env.uc.rateMeal({ ...meal, verdict: 'up' });
    expect(env.ports.state.companion).toMatchObject({ streak: 1, best: 1 });
    // Repas inexistant : pas de geste.
    nextDay(env.ports);
    await env.uc.rateMeal({ weekStart: meal.weekStart, mealId: 'nope', verdict: 'up' });
    expect(env.ports.state.companion.streak).toBe(1);
  });

  it('cocher un article compte, décocher non, ajouter ou vider non', async () => {
    const env = await setup();
    const key = firstKey(await env.uc.getShoppingList());
    await env.uc.addShoppingItem({ label: 'Café' });
    await env.uc.uncheckAllShoppingItems();
    expect(env.ports.state.companion).toEqual(INITIAL_COMPANION_STATE);

    await env.uc.toggleShoppingItem(key); // coche
    expect(env.ports.state.companion).toMatchObject({ streak: 1, lastActiveDay: '2026-11-23' });
    nextDay(env.ports);
    await env.uc.toggleShoppingItem(key); // décoche : pas un geste
    expect(env.ports.state.companion).toMatchObject({ streak: 1, lastActiveDay: '2026-11-23' });
    await env.uc.toggleShoppingItem(key); // coche à nouveau, le lendemain
    expect(env.ports.state.companion).toMatchObject({ streak: 2, lastActiveDay: '2026-11-24' });
  });

  it('sans profil, cocher ne compte pas', async () => {
    const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES });
    const uc = createUseCases(ports);
    await uc.toggleShoppingItem('x');
    expect(ports.state.companion).toEqual(INITIAL_COMPANION_STATE);
  });

  it('les jours sont ceux de l’appareil (fuseau local)', async () => {
    const ports = createInMemoryPorts({
      recipes: FIXTURE_RECIPES,
      questions: QUESTIONS,
      clock: new FixedClock('2026-11-23T23:30:00.000Z', 120),
    });
    const uc = createUseCases(ports);
    await uc.saveProfile(makeProfile());
    const quiz = await uc.getQuiz();
    await uc.answerQuiz({ questionId: quiz?.questionId ?? '', answerIndex: 1 });
    expect(ports.state.companion.lastActiveDay).toBe('2026-11-24');
  });

  it('un échec du compagnon ne fait pas échouer le geste', async () => {
    const env = await setup();
    const failing = {
      ...env.ports,
      companion: {
        get: () => Promise.reject(new Error('disque plein')),
        save: () => Promise.reject(new Error('disque plein')),
      },
    };
    const uc = createUseCases(failing);
    const meal = await firstMeal(env);
    await expect(uc.rateMeal({ ...meal, verdict: 'up' })).resolves.toMatchObject({
      verdict: 'up',
    });
    expect(env.ports.state.ratings.size).toBe(1);
  });
});

describe('customizeCompanion', () => {
  const dressed: CompanionLook = {
    color: 'citron',
    eyes: 'malicieux',
    accessories: { tete: 'feuille' },
  };

  it('refuse un élément pas encore débloqué, avec un message doux', async () => {
    const { uc, ports } = await setup();
    const result = await uc.customizeCompanion(dressed);
    expect(result).toEqual({
      status: 'refused',
      reason: 'locked',
      message: COMPANION_MESSAGES.locked,
    });
    expect(ports.state.companion).toEqual(INITIAL_COMPANION_STATE);
  });

  it('refuse un élément inconnu', async () => {
    const { uc } = await setup();
    const look = { ...DEFAULT_LOOK, color: 'noir' } as unknown as CompanionLook;
    await expect(uc.customizeCompanion(look)).resolves.toMatchObject({
      status: 'refused',
      reason: 'unknown',
      message: COMPANION_MESSAGES.unknown,
    });
  });

  it('enregistre l’apparence une fois débloquée et la rend dans la vue', async () => {
    const env = await setup();
    await answer(env);
    const result = await env.uc.customizeCompanion(dressed);
    expect(result).toMatchObject({ status: 'saved', companion: { look: dressed } });
    expect((await env.uc.getCompanion()).look).toEqual(dressed);
    // L'apparence survit à une série interrompue.
    nextDay(env.ports);
    nextDay(env.ports);
    expect(await env.uc.getCompanion()).toMatchObject({ mood: 'sieste', look: dressed });
  });
});

describe('acknowledgeUnlocks', () => {
  it('le déblocage est signalé jusqu’à acquittement, puis plus', async () => {
    const env = await setup();
    await answer(env);
    expect((await env.uc.getCompanion()).newlyUnlocked).toHaveLength(1);
    expect((await env.uc.getCompanion()).newlyUnlocked).toHaveLength(1);
    const acknowledged = await env.uc.acknowledgeUnlocks();
    expect(acknowledged.newlyUnlocked).toEqual([]);
    expect((await env.uc.getCompanion()).newlyUnlocked).toEqual([]);
    // Idempotent, et les suivants sont signalés à leur tour.
    await env.uc.acknowledgeUnlocks();
    nextDay(env.ports);
    await answer(env);
    nextDay(env.ports);
    await answer(env);
    expect((await env.uc.getCompanion()).newlyUnlocked.map((i) => i.id)).toEqual([
      'lunettes-rondes',
    ]);
  });
});

describe('données de la personne', () => {
  it('le compagnon part dans l’export, revient à l’import et disparaît avec « Tout effacer »', async () => {
    const env = await setup();
    await answer(env);
    await env.uc.customizeCompanion({ ...DEFAULT_LOOK, accessories: { tete: 'feuille' } });
    await env.uc.exportData();
    const content = env.ports.fileSaver.files[0]?.content ?? '';
    expect(JSON.parse(content)).toMatchObject({ companion: { best: 1 } });

    await env.uc.wipeAllData();
    expect(env.ports.state.companion).toEqual(INITIAL_COMPANION_STATE);
    await env.uc.importData({ content });
    expect(env.ports.state.companion).toMatchObject({
      best: 1,
      look: { accessories: { tete: 'feuille' } },
    });
  });
});
