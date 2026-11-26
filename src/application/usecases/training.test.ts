import { describe, expect, it } from 'vitest';
import { FixedClock, createInMemoryPorts } from '../testing';
import type { InMemoryPorts } from '../testing';
import { createUseCases } from '.';
import type { UseCases } from '.';
import {
  EXERCISE_CREDITS_TEXTS,
  MAX_SETS_PER_EXERCISE,
  TRAINING_FAILURE_MESSAGES,
  TRAINING_MESSAGES,
} from './training';
import type { TrainingWeekView } from './training';
import { EXERCISE_FIXTURES, fixtureExercise } from '@domain/testing/exercises.fixtures';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';
import { WEEK } from '@domain/testing/training.fixtures';
import { TRAINING_DISCLAIMER, avoidedExerciseIds, defaultTrainingInput } from '@domain/training';
import type { Exercise, SessionLog, TrainingProfileInput } from '@domain/training';

/** Mercredi 25 novembre 2026 : la semaine du lundi 23. */
const NOW = '2026-11-25T10:00:00.000Z';

interface Env {
  readonly ports: InMemoryPorts;
  readonly uc: UseCases;
}

function build(options: { exercises?: readonly Exercise[]; wakeLockSupported?: boolean } = {}) {
  const ports = createInMemoryPorts({
    recipes: FIXTURE_RECIPES,
    exercises: options.exercises ?? EXERCISE_FIXTURES,
    clock: new FixedClock(NOW),
    ...(options.wakeLockSupported === undefined
      ? {}
      : { wakeLockSupported: options.wakeLockSupported }),
  });
  return { ports, uc: createUseCases(ports) };
}

/** Profil Nourriture + profil sportif (3 séances, à la maison équipée, intermédiaire). */
async function setup(
  input: Partial<TrainingProfileInput> = {},
  options: Parameters<typeof build>[0] = {},
): Promise<Env> {
  const env = build(options);
  await env.uc.saveProfile(makeProfile());
  const saved = await env.uc.saveTrainingProfile({
    ...defaultTrainingInput(),
    setting: 'maison-equipee',
    equipment: ['tapis', 'halteres', 'elastique'],
    level: 'intermediaire',
    goal: 'muscle',
    sessionMinutes: 45,
    ...input,
  });
  expect(saved.status).toBe('saved');
  return env;
}

async function week({ uc }: Env): Promise<TrainingWeekView> {
  const view = await uc.getTrainingWeek();
  if (view.status !== 'ready') throw new Error(`programme attendu, reçu ${view.status}`);
  return view;
}

/** Première séance de renforcement du programme et son premier exercice principal. */
async function target(env: Env) {
  const view = await week(env);
  const session = view.plan.sessions.find((s) => s.kind !== 'douce' && s.main.length > 0);
  const slot = session?.main[0];
  if (!session || !slot) throw new Error('séance attendue');
  return { view, session, slot, ref: { weekStart: view.plan.weekStart, sessionId: session.id } };
}

async function started(env: Env) {
  const t = await target(env);
  const result = await env.uc.startSession(t.ref);
  if (result.status !== 'ready') throw new Error('séance commencée attendue');
  return { ...t, view: result };
}

/** Coche toutes les séries d'un exercice, une par une. */
async function tickAll(env: Env, ref: { weekStart: string; sessionId: string }, slotId: string) {
  const t = await target(env);
  const item = t.session.main.find((i) => i.slotId === slotId);
  for (let index = 0; index < (item?.prescription.sets ?? 0); index += 1) {
    await env.uc.logSet({ ...ref, slotId, set: { index, done: true, reps: 10 } });
  }
}

describe('profil sportif', () => {
  it('sans profil Nourriture : rien à proposer', async () => {
    const { uc } = build();
    expect(await uc.getTrainingProfile()).toEqual({ status: 'no-profile' });
    expect(await uc.saveTrainingProfile(defaultTrainingInput())).toEqual({ status: 'no-profile' });
    expect(await uc.acknowledgeTrainingSafety()).toEqual({ status: 'no-profile' });
    expect(await uc.getTrainingWeek()).toEqual({ status: 'no-profile' });
    expect(await uc.getTrainingDays()).toBeUndefined();
  });

  it('Sport non activé : les réponses proposées, et la question de grossesse seulement si besoin', async () => {
    const { uc } = build();
    await uc.saveProfile(makeProfile({ sex: 'femme', pregnantOrBreastfeeding: true }));
    expect(await uc.getTrainingProfile()).toEqual({
      status: 'inactive',
      askPregnancyStage: true,
      defaults: defaultTrainingInput(),
    });
    expect(await uc.acknowledgeTrainingSafety()).toMatchObject({ status: 'inactive' });
    expect(await uc.getTrainingWeek()).toEqual({ status: 'inactive' });
    expect(await uc.getTrainingDays()).toBeUndefined();
    expect(await uc.getTrainingSession({ weekStart: WEEK, sessionId: 'd0' })).toEqual({
      status: 'inactive',
    });
  });

  it('refuse des réponses invalides sans rien enregistrer', async () => {
    const { ports, uc } = build();
    await uc.saveProfile(makeProfile());
    const result = await uc.saveTrainingProfile({ ...defaultTrainingInput(), days: [1] });
    expect(result).toMatchObject({ status: 'invalid', issues: [{ field: 'days' }] });
    expect(ports.state.training).toBeUndefined();
  });

  it('enregistre, garde le début d’une édition à l’autre et relit le profil', async () => {
    const env = await setup();
    const first = await env.uc.getTrainingProfile();
    if (first.status !== 'active') throw new Error('profil actif attendu');
    expect(first.profile.startedOn).toBe(WEEK);
    expect(first.input.goal).toBe('muscle');
    expect(first.disclaimer).toBe(TRAINING_DISCLAIMER);
    expect(first.needsAcknowledgement).toBe(false);
    env.ports.clock.set('2026-12-09T10:00:00.000Z');
    const saved = await env.uc.saveTrainingProfile({ ...first.input, goal: 'force' });
    expect(saved).toMatchObject({ status: 'saved', profile: { goal: 'force', startedOn: WEEK } });
  });

  it('l’échec du stockage rend un message doux et ne change rien', async () => {
    const { ports, uc } = build();
    await uc.saveProfile(makeProfile());
    ports.training.saveProfile = () => Promise.reject(new Error('plein'));
    expect(await uc.saveTrainingProfile(defaultTrainingInput())).toEqual({
      status: 'failed',
      message: TRAINING_FAILURE_MESSAGES.save,
    });
    expect(ports.state.training).toBeUndefined();
  });

  it('« J’ai compris » : une condition de santé demande la lecture, une fois', async () => {
    const env = build();
    await env.uc.saveProfile(makeProfile({ healthCondition: true }));
    await env.uc.saveTrainingProfile(defaultTrainingInput());
    const before = await env.uc.getTrainingProfile();
    expect(before).toMatchObject({ status: 'active', needsAcknowledgement: true });
    const after = await env.uc.acknowledgeTrainingSafety();
    expect(after).toMatchObject({
      status: 'active',
      needsAcknowledgement: false,
      profile: { safetyAcknowledgedOn: '2026-11-25' },
    });
  });
});

describe('programme de la semaine', () => {
  it('génère, enregistre, puis rend le même programme (stable toute la semaine)', async () => {
    const env = await setup();
    const first = await week(env);
    expect(first.origin).toBe('generated');
    expect(first.plan.weekStart).toBe(WEEK);
    expect(first.plan.sessions.length).toBeGreaterThan(0);
    expect(first.doneSessions).toBe(0);
    expect(first.plannedSessions).toBe(first.plan.sessions.length);
    expect(first.trainingDays.trainingDays.length).toBeGreaterThan(0);
    expect(first.today).toBe('2026-11-25');
    const second = await week(env);
    expect(second.origin).toBe('stored');
    expect(second.plan).toEqual(first.plan);
    // Tous les exercices du programme sont fournis à l'interface.
    for (const session of second.plan.sessions) {
      for (const item of session.main) expect(second.exercises[item.exerciseId]).toBeDefined();
    }
    expect(await env.uc.getTrainingDays()).toEqual(first.trainingDays);
  });

  it('régénère quand l’empreinte des contraintes change (objectif, jours, santé)', async () => {
    const env = await setup();
    const first = await week(env);
    const profile = await env.uc.getTrainingProfile();
    if (profile.status !== 'active') throw new Error('actif attendu');
    await env.uc.saveTrainingProfile({ ...profile.input, goal: 'endurance' });
    const second = await week(env);
    expect(second.origin).toBe('regenerated');
    expect(second.plan.constraintsKey).not.toBe(first.plan.constraintsKey);
    // Un changement du profil Nourriture lu par la sécurité régénère aussi.
    await env.uc.saveProfile(makeProfile({ healthCondition: true }));
    const third = await week(env);
    expect(third.origin).toBe('regenerated');
    expect(third.safety.maxStrengthSessions).toBeLessThanOrEqual(3);
  });

  it('régénère un programme dont un exercice a quitté le catalogue', async () => {
    const env = await setup();
    const first = await week(env);
    const used = first.plan.sessions[0]?.main[0]?.exerciseId;
    env.ports.exercises.exercises = env.ports.exercises.exercises.filter((e) => e.id !== used);
    const second = await week(env);
    expect(second.origin).toBe('regenerated');
    expect(
      second.plan.sessions.flatMap((s) => s.main).some((item) => item.exerciseId === used),
    ).toBe(false);
  });

  it('échec du catalogue ou du stockage : message doux, jamais d’exception', async () => {
    const env = await setup();
    env.ports.exercises.getExercises = () => Promise.reject(new Error('hors ligne'));
    expect(await env.uc.getTrainingWeek()).toEqual({
      status: 'failed',
      message: TRAINING_FAILURE_MESSAGES.load,
    });
    // Le lien avec la Nourriture est facultatif : pas de jours, pas d'erreur.
    expect(await env.uc.getTrainingDays()).toBeUndefined();
  });

  it('n’utilise que les journaux des semaines passées pour le cycle (semaine allégée)', async () => {
    const env = await setup();
    // Quatre semaines actives de suite (intermédiaire : bloc de 5) → la cinquième est allégée.
    const logs: SessionLog[] = ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'].map(
      (weekStart) => ({
        id: `${weekStart}:d0`,
        weekStart,
        sessionId: 'd0',
        date: weekStart,
        status: 'terminee' as const,
        startedAt: `${weekStart}T10:00:00.000Z`,
        completedAt: `${weekStart}T11:00:00.000Z`,
        exercises: [],
      }),
    );
    for (const log of logs) await env.ports.sessionLogs.save(log);
    const view = await week(env);
    expect(view.plan.cycle).toMatchObject({ activeWeeks: 4, deload: true });
  });
});

describe('séance guidée', () => {
  it('une séance inconnue ou une semaine invalide est refusée avec un message', async () => {
    const env = await setup();
    const t = await target(env);
    const unknown = { weekStart: t.view.plan.weekStart, sessionId: 'zz' };
    const expected = { status: 'unavailable', message: TRAINING_MESSAGES.unavailable };
    expect(await env.uc.getTrainingSession(unknown)).toEqual(expected);
    expect(await env.uc.startSession(unknown)).toEqual(expected);
    expect(await env.uc.startSession({ weekStart: 'pas-une-date', sessionId: 'd0' })).toEqual(
      expected,
    );
    expect(await env.uc.startSession({ weekStart: '2026-11-16', sessionId: 'd0' })).toEqual(
      expected,
    );
    // Sans séance commencée, rien ne s'enregistre.
    const slotRef = { ...t.ref, slotId: t.slot.slotId };
    expect(await env.uc.logSet({ ...slotRef, set: { index: 0, done: true } })).toEqual(expected);
    expect(await env.uc.markExerciseDone(slotRef)).toEqual(expected);
    expect(await env.uc.reportPain(slotRef)).toEqual(expected);
    expect(await env.uc.completeSession(t.ref)).toEqual(expected);
    expect(await env.uc.getExerciseAlternatives(slotRef)).toEqual(expected);
  });

  it('avant le début : la séance et son avancement, sans journal', async () => {
    const env = await setup();
    const t = await target(env);
    const view = await env.uc.getTrainingSession(t.ref);
    if (view.status !== 'ready') throw new Error('séance attendue');
    expect(view.log).toBeUndefined();
    expect(view.complete).toBe(false);
    expect(view.completion.doneSets).toBe(0);
    expect(view.completion.plannedSets).toBeGreaterThan(0);
    expect(view.exercises[t.slot.exerciseId]).toBeDefined();
  });

  it('commence une séance, puis la reprend sans rien écraser', async () => {
    const env = await setup();
    const s = await started(env);
    expect(s.view.log).toMatchObject({
      id: `${s.view.weekStart}:${s.session.id}`,
      status: 'en-cours',
      date: '2026-11-25',
      startedAt: NOW,
    });
    expect(s.view.log.exercises).toHaveLength(s.session.main.length);
    await env.uc.logSet({
      ...s.ref,
      slotId: s.slot.slotId,
      set: { index: 0, done: true, reps: 9, loadKg: 12.5 },
    });
    env.ports.clock.set('2026-11-25T18:00:00.000Z');
    const again = await env.uc.startSession(s.ref);
    if (again.status !== 'ready') throw new Error('reprise attendue');
    expect(again.log.startedAt).toBe(NOW);
    expect(again.log.exercises[0]?.sets[0]).toEqual({
      index: 0,
      done: true,
      reps: 9,
      loadKg: 12.5,
    });
    expect(again.completion.doneSets).toBe(1);
  });

  it('enregistre les séries et valide un exercice d’un geste', async () => {
    const env = await setup();
    const s = await started(env);
    const slotRef = { ...s.ref, slotId: s.slot.slotId };
    const logged = await env.uc.logSet({ ...slotRef, set: { index: 1, done: true, seconds: 30 } });
    expect(logged).toMatchObject({ status: 'ready' });
    expect(env.ports.state.sessionLogs.get(s.view.log.id)?.exercises[0]?.sets[1]?.seconds).toBe(30);
    const done = await env.uc.markExerciseDone(slotRef);
    if (done.status !== 'ready') throw new Error('attendu');
    expect(done.log.exercises[0]).toMatchObject({ done: true });
    expect(done.log.exercises[0]?.sets.every((set) => set.done)).toBe(true);
  });

  it('refuse les séries hors bornes et les créneaux inconnus', async () => {
    const env = await setup();
    const s = await started(env);
    const slotRef = { ...s.ref, slotId: s.slot.slotId };
    const bad = { status: 'unavailable', message: TRAINING_MESSAGES.invalidSet };
    for (const set of [
      { index: -1, done: true },
      { index: MAX_SETS_PER_EXERCISE, done: true },
      { index: 0.5, done: true },
      { index: 0, done: true, reps: 201 },
      { index: 0, done: true, reps: 1.5 },
      { index: 0, done: true, reps: -1 },
      { index: 0, done: true, seconds: 3_601 },
      { index: 0, done: true, loadKg: 501 },
      { index: 0, done: true, loadKg: Number.NaN },
      { index: 0, done: 'oui' as unknown as boolean },
    ]) {
      expect(await env.uc.logSet({ ...slotRef, set }), JSON.stringify(set)).toEqual(bad);
    }
    const noSlot = { status: 'unavailable', message: TRAINING_MESSAGES.unavailableExercise };
    expect(await env.uc.logSet({ ...s.ref, slotId: 'zz', set: { index: 0, done: true } })).toEqual(
      noSlot,
    );
    expect(await env.uc.markExerciseDone({ ...s.ref, slotId: 'zz' })).toEqual(noSlot);
    expect(await env.uc.getExerciseAlternatives({ ...s.ref, slotId: 'zz' })).toEqual(noSlot);
    expect(await env.uc.reportPain({ ...s.ref, slotId: 'zz' })).toEqual(noSlot);
    // Les bornes exactes passent, et seules les clés connues sont recopiées.
    const ok = await env.uc.logSet({
      ...slotRef,
      set: { index: 19, done: false, reps: 200, seconds: 3_600, loadKg: 500, extra: 1 } as never,
    });
    expect(ok.status).toBe('ready');
    const stored = env.ports.state.sessionLogs.get(s.view.log.id)?.exercises[0]?.sets.at(-1);
    expect(stored).toEqual({ index: 19, done: false, reps: 200, seconds: 3_600, loadKg: 500 });
  });

  it('une erreur de stockage pendant la séance rend un message doux', async () => {
    const env = await setup();
    const s = await started(env);
    env.ports.sessionLogs.save = () => Promise.reject(new Error('plein'));
    expect(
      await env.uc.logSet({ ...s.ref, slotId: s.slot.slotId, set: { index: 0, done: true } }),
    ).toEqual({ status: 'failed', message: TRAINING_FAILURE_MESSAGES.save });
    expect(await env.uc.getTrainingSession(s.ref)).toMatchObject({ status: 'ready' });
  });
});

describe('remplacer un exercice', () => {
  it('propose des remplaçants adaptés, du même schéma, et applique le choix au journal et au programme', async () => {
    const env = await setup();
    const s = await started(env);
    const slotRef = { ...s.ref, slotId: s.slot.slotId };
    const choices = await env.uc.getExerciseAlternatives(slotRef);
    if (choices.status !== 'ready') throw new Error('remplaçants attendus');
    expect(choices.alternatives.length).toBeGreaterThan(0);
    expect(choices.alternatives.length).toBeLessThanOrEqual(3);
    const choice = choices.alternatives[0];
    if (!choice) throw new Error('choix attendu');
    expect(choice.pattern).toBe(s.slot.pattern);
    expect(choice.id).not.toBe(s.slot.exerciseId);

    await env.uc.logSet({ ...slotRef, set: { index: 0, done: true } });
    const result = await env.uc.replaceExercise({ ...slotRef, exerciseId: choice.id });
    if (result.status !== 'ready') throw new Error('remplacement attendu');
    expect(result.log.exercises[0]).toMatchObject({
      exerciseId: choice.id,
      replacedExerciseId: s.slot.exerciseId,
      done: false,
    });
    // Les séries sont remises à zéro pour le nouvel exercice, en même nombre.
    expect(result.log.exercises[0]?.sets.every((set) => !set.done)).toBe(true);
    expect(result.log.exercises[0]?.sets).toHaveLength(s.slot.prescription.sets);
    // Le programme enregistré suit : le remplacement reste toute la semaine.
    const stored = env.ports.state.trainingPlans.get(s.view.weekStart);
    const planned = stored?.sessions.find((x) => x.id === s.session.id)?.main[0];
    expect(planned).toMatchObject({ exerciseId: choice.id, slotId: s.slot.slotId });
    expect(planned?.prescription.sets).toBe(s.slot.prescription.sets);
    expect((await week(env)).origin).toBe('stored');
  });

  it('refuse un exercice qui ne fait pas partie des remplaçants proposés', async () => {
    const env = await setup();
    const s = await started(env);
    const slotRef = { ...s.ref, slotId: s.slot.slotId };
    const result = await env.uc.replaceExercise({ ...slotRef, exerciseId: 'pas-un-exercice' });
    expect(result).toEqual({ status: 'unavailable', message: TRAINING_MESSAGES.noReplacement });
    expect(await env.uc.replaceExercise({ ...s.ref, slotId: 'zz', exerciseId: 'x' })).toEqual({
      status: 'unavailable',
      message: TRAINING_MESSAGES.unavailableExercise,
    });
    expect(env.ports.state.sessionLogs.get(s.view.log.id)?.exercises[0]?.exerciseId).toBe(
      s.slot.exerciseId,
    );
  });
});

describe('« Ça fait mal »', () => {
  it('signale, écarte l’exercice 28 jours et le remplace par un exercice plus doux', async () => {
    const env = await setup();
    const s = await started(env);
    const slotRef = { ...s.ref, slotId: s.slot.slotId };
    const result = await env.uc.reportPain(slotRef);
    if (result.status !== 'reported') throw new Error('signalement attendu');
    expect(result.messages.map((m) => m.code)).toEqual(['douleur', 'urgence']);
    expect(result.avoidedUntil).toBe('2026-12-23');
    const replacement = result.replacement;
    if (!replacement) throw new Error('remplaçant attendu');
    expect(replacement.id).not.toBe(s.slot.exerciseId);
    expect(replacement.pattern).toBe(s.slot.pattern);
    expect(result.session.log.exercises[0]).toMatchObject({
      exerciseId: replacement.id,
      replacedExerciseId: s.slot.exerciseId,
    });

    const report = env.ports.state.painReports.get(`2026-11-25:${s.slot.exerciseId}`);
    expect(report).toMatchObject({ date: '2026-11-25', exerciseId: s.slot.exerciseId });
    expect(report?.muscles.length).toBeGreaterThan(0);
    expect(avoidedExerciseIds([...env.ports.state.painReports.values()], '2026-11-25')).toContain(
      s.slot.exerciseId,
    );

    // Le programme n'en contient plus nulle part (régénéré si besoin) ; le journal garde la trace.
    const after = await week(env);
    expect(
      after.plan.sessions.flatMap((x) => x.main).some((i) => i.exerciseId === s.slot.exerciseId),
    ).toBe(false);
    expect(env.ports.state.sessionLogs.get(s.view.log.id)?.exercises[0]?.replacedExerciseId).toBe(
      s.slot.exerciseId,
    );
    // Le jour 28, il est de nouveau permis.
    env.ports.clock.set('2026-12-23T10:00:00.000Z');
    expect(avoidedExerciseIds([...env.ports.state.painReports.values()], '2026-12-23')).toEqual([]);
  });

  it('deux signalements sur une même zone en 14 jours : message dédié', async () => {
    const env = await setup();
    const s = await started(env);
    const slotRef = { ...s.ref, slotId: s.slot.slotId };
    const first = await env.uc.reportPain(slotRef);
    expect(first.status === 'reported' && first.messages.map((m) => m.code)).not.toContain(
      'douleur-repetee',
    );
    const second = await env.uc.reportPain(slotRef);
    if (second.status !== 'reported') throw new Error('signalement attendu');
    expect(second.messages.map((m) => m.code)).toEqual(['douleur', 'douleur-repetee', 'urgence']);
  });

  it('sans remplaçant adapté : le signalement est gardé, l’exercice reste, le message est donné', async () => {
    const full = await setup();
    const t = await target(full);
    const only = EXERCISE_FIXTURES.filter(
      (e) => e.pattern !== t.slot.pattern || e.id === t.slot.exerciseId,
    );
    const env = await setup({}, { exercises: only });
    const s = await started(env);
    expect(s.slot.pattern).toBe(t.slot.pattern);
    const result = await env.uc.reportPain({ ...s.ref, slotId: s.slot.slotId });
    if (result.status !== 'reported') throw new Error('signalement attendu');
    expect(result.replacement).toBeUndefined();
    expect(result.messages.map((m) => m.code)).toContain('douleur');
    expect(env.ports.state.painReports.size).toBe(1);
  });
});

describe('terminer la séance', () => {
  it('refuse de terminer une séance sans série cochée', async () => {
    const env = await setup();
    const s = await started(env);
    expect(await env.uc.completeSession(s.ref)).toEqual({
      status: 'nothing-done',
      message: TRAINING_MESSAGES.nothingDone,
    });
    expect(env.ports.state.sessionLogs.get(s.view.log.id)?.status).toBe('en-cours');
    expect(env.ports.state.companion.streak).toBe(0);
  });

  it('cocher une série seule ne compte pas comme geste ; terminer compte comme geste de la série', async () => {
    const env = await setup();
    const s = await started(env);
    await env.uc.logSet({
      ...s.ref,
      slotId: s.slot.slotId,
      set: { index: 0, done: true, reps: 8 },
    });
    expect(env.ports.state.companion.streak).toBe(0);
    env.ports.clock.set('2026-11-25T11:00:00.000Z');
    const result = await env.uc.completeSession({ ...s.ref, effort: 'difficile' });
    if (result.status !== 'completed') throw new Error('séance terminée attendue');
    expect(result.sessionsCompleted).toBe(1);
    expect(result.newAccessories.map((a) => a.id)).toEqual(['bandeau']);
    expect(result.session.log).toMatchObject({
      status: 'terminee',
      completedAt: '2026-11-25T11:00:00.000Z',
      effort: 'difficile',
    });
    expect(env.ports.state.companion).toMatchObject({ streak: 1, lastActiveDay: '2026-11-25' });
    expect((await week(env)).doneSessions).toBe(1);
  });

  it('est idempotente : terminer deux fois ne compte qu’une séance', async () => {
    const env = await setup();
    const s = await started(env);
    await env.uc.markExerciseDone({ ...s.ref, slotId: s.slot.slotId });
    const first = await env.uc.completeSession(s.ref);
    const second = await env.uc.completeSession({ ...s.ref, effort: 'facile' });
    expect(first.status).toBe('completed');
    expect(second).toMatchObject({ status: 'completed', sessionsCompleted: 1, newAccessories: [] });
    expect(env.ports.state.sessionLogs.get(s.view.log.id)?.effort).toBeUndefined();
  });

  it('ignore un ressenti inconnu', async () => {
    const env = await setup();
    const s = await started(env);
    await tickAll(env, s.ref, s.slot.slotId);
    await env.uc.completeSession({ ...s.ref, effort: 'epique' as never });
    expect(env.ports.state.sessionLogs.get(s.view.log.id)?.effort).toBeUndefined();
  });

  it('un échec du compagnon n’annule pas la séance', async () => {
    const env = await setup();
    const s = await started(env);
    await env.uc.markExerciseDone({ ...s.ref, slotId: s.slot.slotId });
    env.ports.companion.save = () => Promise.reject(new Error('plein'));
    const result = await env.uc.completeSession(s.ref);
    expect(result.status).toBe('completed');
    expect(env.ports.state.sessionLogs.get(s.view.log.id)?.status).toBe('terminee');
  });

  it('accessoires débloqués au nombre cumulé de séances terminées, rien ne se reperd', async () => {
    const env = await setup();
    // Quatre séances d'autres semaines déjà terminées : la cinquième débloque la serviette.
    for (const [i, weekStart] of [
      '2026-10-26',
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
    ].entries()) {
      await env.ports.sessionLogs.save({
        id: `${weekStart}:d${i}`,
        weekStart,
        sessionId: `d${i}`,
        date: weekStart,
        status: 'terminee',
        startedAt: `${weekStart}T10:00:00.000Z`,
        completedAt: `${weekStart}T11:00:00.000Z`,
        exercises: [],
      });
    }
    expect(await env.uc.getSportRewards()).toMatchObject({
      sessionsCompleted: 4,
      unlocked: [{ id: 'bandeau' }],
      next: { accessory: { id: 'serviette' }, remaining: 1 },
    });
    const s = await started(env);
    await env.uc.markExerciseDone({ ...s.ref, slotId: s.slot.slotId });
    const result = await env.uc.completeSession(s.ref);
    expect(result).toMatchObject({
      status: 'completed',
      sessionsCompleted: 5,
      newAccessories: [{ id: 'serviette' }],
    });
    expect(await env.uc.getSportRewards()).toMatchObject({
      sessionsCompleted: 5,
      unlocked: [{ id: 'bandeau' }, { id: 'serviette' }],
      next: { accessory: { id: 'casquette' }, remaining: 5 },
    });
  });
});

describe('historique, fiches et crédits', () => {
  it('historique : la séance terminée avec son titre, la plus récente d’abord', async () => {
    const env = await setup();
    expect(await env.uc.getTrainingHistory()).toEqual({ entries: [], sessionsCompleted: 0 });
    const s = await started(env);
    await env.uc.markExerciseDone({ ...s.ref, slotId: s.slot.slotId });
    await env.uc.completeSession({ ...s.ref, effort: 'correct' });
    const history = await env.uc.getTrainingHistory();
    expect(history.sessionsCompleted).toBe(1);
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0]).toMatchObject({
      id: s.view.log.id,
      title: s.session.title,
      status: 'terminee',
      effort: 'correct',
    });
    expect(history.entries[0]?.doneSets).toBeGreaterThan(0);
  });

  it('fiche d’exercice : exercice, médias et mention de prudence', async () => {
    const media = {
      exerciseId: 'pompes',
      images: [],
      videos: [],
      links: [
        { kind: 'youtube' as const, url: 'https://www.youtube.com/results?search_query=pompes' },
      ],
      credit: {
        provider: 'nutry' as const,
        authors: ['Nutry'],
        license: 'MIT' as const,
        licenseUrl: 'https://opensource.org/licenses/MIT',
        modified: '',
      },
    };
    const ports = createInMemoryPorts({ exercises: EXERCISE_FIXTURES, exerciseMedia: [media] });
    const uc = createUseCases(ports);
    expect(await uc.getExerciseSheet('pompes')).toMatchObject({
      exercise: { id: 'pompes' },
      media,
      disclaimer: TRAINING_DISCLAIMER,
    });
    expect((await uc.getExerciseSheet('squat'))?.media).toBeUndefined();
    expect(await uc.getExerciseSheet('inconnu')).toBeUndefined();
    ports.exercises.getExercises = () => Promise.reject(new Error('hors ligne'));
    expect(await uc.getExerciseSheet('pompes')).toBeUndefined();
  });

  it('crédits : contenu Nutry sous MIT et vidéos listées', async () => {
    const credit = {
      provider: 'nutry' as const,
      authors: ['Nutry'],
      license: 'MIT' as const,
      licenseUrl: 'https://opensource.org/licenses/MIT',
      modified: '',
    };
    const video = {
      src: '/exercices/videos/pompes.mp4',
      durationSeconds: 20,
      provider: 'mixkit' as const,
      author: 'Mixkit',
      license: 'Mixkit' as const,
      licenseUrl: 'https://mixkit.co/license/',
      sourceUrl: 'https://mixkit.co/free-stock-video/x/',
    };
    const ports = createInMemoryPorts({
      exercises: EXERCISE_FIXTURES,
      exerciseMedia: [
        { exerciseId: 'pompes', images: [], videos: [video], links: [], credit },
        { exerciseId: 'squat', images: [], videos: [], links: [], credit },
      ],
    });
    const view = await createUseCases(ports).listExerciseCredits();
    expect(view.texts).toBe(EXERCISE_CREDITS_TEXTS);
    expect(view.exerciseCount).toBe(EXERCISE_FIXTURES.length);
    expect(view.credit).toEqual(credit);
    expect(view.videos).toEqual([
      { exerciseId: 'pompes', exerciseName: fixtureExercise('pompes').name, video },
    ]);

    const empty = createUseCases(createInMemoryPorts());
    expect(await empty.listExerciseCredits()).toMatchObject({
      exerciseCount: 0,
      credit: undefined,
      videos: [],
    });
    const broken = createInMemoryPorts({ exercises: EXERCISE_FIXTURES });
    broken.exercises.getMedia = () => Promise.reject(new Error('x'));
    expect(await createUseCases(broken).listExerciseCredits()).toMatchObject({
      credit: undefined,
      videos: [],
    });
    broken.exercises.getExercises = () => Promise.reject(new Error('x'));
    expect(await createUseCases(broken).listExerciseCredits()).toMatchObject({ exerciseCount: 0 });
  });
});

describe('écran maintenu allumé', () => {
  it('demande et relâche le verrou ; repli silencieux sans l’API ou en cas d’erreur', async () => {
    const { ports, uc } = build();
    expect(await uc.keepScreenOn()).toBe(true);
    expect(ports.wakeLock.held).toBe(true);
    await uc.releaseScreen();
    expect(ports.wakeLock.held).toBe(false);

    const unsupported = build({ wakeLockSupported: false });
    expect(await unsupported.uc.keepScreenOn()).toBe(false);

    const failing = build();
    failing.ports.wakeLock.acquire = () => Promise.reject(new Error('refusé'));
    failing.ports.wakeLock.release = () => Promise.reject(new Error('refusé'));
    expect(await failing.uc.keepScreenOn()).toBe(false);
    await expect(failing.uc.releaseScreen()).resolves.toBeUndefined();
  });
});

describe('confidentialité', () => {
  it('un parcours complet n’envoie ni ne partage rien', async () => {
    const env = await setup();
    const s = await started(env);
    await env.uc.reportPain({ ...s.ref, slotId: s.slot.slotId });
    await env.uc.markExerciseDone({ ...s.ref, slotId: s.slot.slotId });
    await env.uc.completeSession(s.ref);
    await env.uc.getTrainingHistory();
    expect(env.ports.sharer.shared).toEqual([]);
    expect(env.ports.fileSaver.files).toEqual([]);
  });

  it('« Tout effacer » supprime toutes les données sportives, l’export les contient', async () => {
    const env = await setup();
    const s = await started(env);
    await env.uc.reportPain({ ...s.ref, slotId: s.slot.slotId });
    await env.uc.markExerciseDone({ ...s.ref, slotId: s.slot.slotId });
    await env.uc.completeSession(s.ref);
    await env.uc.exportData();
    const file = JSON.parse(env.ports.fileSaver.files[0]?.content ?? '') as Record<string, unknown>;
    expect(file['schemaVersion']).toBe(4);
    expect(file['training']).toBeDefined();
    expect((file['sessionLogs'] as unknown[]).length).toBe(1);
    expect((file['painReports'] as unknown[]).length).toBe(1);
    expect((file['trainingPlans'] as unknown[]).length).toBeGreaterThan(0);

    expect(await env.uc.wipeAllData()).toEqual({ status: 'wiped' });
    expect(env.ports.state.training).toBeUndefined();
    expect(env.ports.state.trainingPlans.size).toBe(0);
    expect(env.ports.state.sessionLogs.size).toBe(0);
    expect(env.ports.state.painReports.size).toBe(0);
    expect(await env.uc.getTrainingProfile()).toEqual({ status: 'no-profile' });

    // L'import remet tout à l'identique.
    const content = env.ports.fileSaver.files[0]?.content ?? '';
    expect(await env.uc.importData({ content })).toMatchObject({ status: 'imported' });
    expect(env.ports.state.sessionLogs.size).toBe(1);
    expect(env.ports.state.painReports.size).toBe(1);
    expect(env.ports.state.training).toBeDefined();
  });
});

describe('lien Nourriture : niveau d’activité suggéré', () => {
  it('Sport inactif ou volume faible : rien à proposer', async () => {
    const { uc } = build();
    await uc.saveProfile(makeProfile({ activity: 'sedentaire' }));
    expect(await uc.getActivitySuggestion()).toBeUndefined();
    const env = await setup({ frequency: 1, days: [0], sessionMinutes: 20 });
    expect(await env.uc.getActivitySuggestion()).toBeUndefined();
    expect(await env.uc.acceptActivitySuggestion()).toEqual({ status: 'none' });
  });

  it('propose le niveau suivant, d’un cran au plus, sans rien modifier tant qu’on ne confirme pas', async () => {
    const env = await setup({ frequency: 5, days: [0, 1, 2, 3, 4], sessionMinutes: 60 });
    await env.uc.saveProfile(makeProfile({ activity: 'sedentaire' }));
    const before = await env.uc.getProfile();
    expect(await env.uc.getActivitySuggestion()).toEqual({
      current: 'sedentaire',
      suggested: 'leger',
      weeklyMinutes: 300,
    });
    expect(await env.uc.getProfile()).toEqual(before);
  });

  it('accepter met le profil à jour d’un cran ; la suivante attend 28 jours', async () => {
    const env = await setup({ frequency: 5, days: [0, 1, 2, 3, 4], sessionMinutes: 60 });
    await env.uc.saveProfile(makeProfile({ activity: 'sedentaire' }));
    expect(await env.uc.acceptActivitySuggestion()).toEqual({ status: 'updated', level: 'leger' });
    expect((await env.uc.getProfile())?.profile.activity).toBe('leger');
    expect(await env.uc.getActivitySuggestion()).toBeUndefined();
    env.ports.clock.set('2026-12-23T10:00:00.000Z');
    expect(await env.uc.getActivitySuggestion()).toMatchObject({ suggested: 'modere' });
  });

  it('refuser la masque pendant 28 jours, puis elle peut revenir', async () => {
    const env = await setup({ frequency: 5, days: [0, 1, 2, 3, 4], sessionMinutes: 60 });
    await env.uc.saveProfile(makeProfile({ activity: 'sedentaire' }));
    await env.uc.dismissActivitySuggestion();
    expect((await env.uc.getSettings()).activitySuggestionDismissedOn).toBe('2026-11-25');
    expect(await env.uc.getActivitySuggestion()).toBeUndefined();
    expect(await env.uc.acceptActivitySuggestion()).toEqual({ status: 'none' });
    env.ports.clock.set('2026-12-23T10:00:00.000Z');
    expect(await env.uc.getActivitySuggestion()).toMatchObject({ suggested: 'leger' });
  });

  it('les portions et les calories ne bougent pas avec le Sport (profil protégé compris)', async () => {
    for (const profile of [makeProfile(), makeProfile({ age: 16 })]) {
      const plain = build();
      await plain.uc.saveProfile(profile);
      const sport = await setup({ frequency: 5, days: [0, 1, 2, 3, 4], sessionMinutes: 60 });
      await sport.uc.saveProfile(profile);
      const a = await plain.uc.getCurrentPlan();
      const b = await sport.uc.getCurrentPlan();
      if (a.status !== 'ready' || b.status !== 'ready') throw new Error('menu attendu');
      expect(b.portionFactor).toBe(a.portionFactor);
      expect((await sport.uc.getProfile())?.energyDetail).toEqual(
        (await plain.uc.getProfile())?.energyDetail,
      );
    }
  });

  it('le menu de la semaine tient compte des jours de séance (composant sport), jamais des filtres', async () => {
    const env = await setup({ frequency: 3, days: [0, 2, 4], sessionMinutes: 45 });
    const plan = await env.uc.getCurrentPlan();
    if (plan.status !== 'ready') throw new Error('menu attendu');
    const days = (await env.uc.getTrainingDays())?.trainingDays ?? [];
    expect(days.length).toBeGreaterThan(0);
    for (const meal of plan.plan.meals) {
      const has = meal.score.components.some((c) => c.key === 'sport');
      const expected =
        !meal.isLeftover && meal.slot !== 'petit-dejeuner' && days.includes(meal.dayIndex);
      expect(has, meal.id).toBe(expected);
    }
    const alternatives = await env.uc.getMealAlternatives('0-diner');
    expect(alternatives.length).toBeGreaterThan(0);
  });
});
