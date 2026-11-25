/**
 * Sport de bout en bout avec les VRAIS adaptateurs (ADR 0015, phase 3) : catalogue embarqué
 * (192 exercices), Dexie (fake-indexeddb), validateur Zod. Stabilité du programme, parcours
 * de séance, aller-retour de sauvegarde 4 → 4 et 3 → 4, effacement total.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  FakeCipher,
  FixedClock,
  InMemoryPhotoCatalog,
  InMemoryQuizRepository,
  RecordingFileSaver,
  RecordingSharer,
  SeededRandom,
  FakePersistence,
} from '@application/testing';
import { createUseCases } from '@application/usecases';
import type { AppPorts } from '@application/usecases';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';
import type { Profile } from '@domain/profile';
import { EQUIPMENT_BY_SETTING, defaultTrainingInput } from '@domain/training';
import type { TrainingProfileInput } from '@domain/training';
import { ZodBackupValidator } from './backup/ZodBackupValidator';
import { StaticExerciseCatalog } from './catalog/StaticExerciseCatalog';
import { InMemoryRecipeRepository } from '@application/testing';
import type { NutryDatabase } from './db/NutryDatabase';
import {
  DexieCompanionRepository,
  DexiePlanRepository,
  DexieProfileRepository,
  DexieProgressRepository,
  DexieQuizStateRepository,
  DexieRatingRepository,
  DexieSettingsRepository,
  DexieShoppingRepository,
  DexieUserDataStore,
} from './db/repositories';
import { createTestDatabase, dexieSportPorts } from './db/testing';

const NOW = '2026-11-25T10:00:00.000Z';
/** Le catalogue embarqué est validé une fois (lourd) puis partagé entre les tests. */
const catalog = new StaticExerciseCatalog('/');

const dbs: NutryDatabase[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
});

function env() {
  const db = createTestDatabase();
  dbs.push(db);
  const fileSaver = new RecordingFileSaver();
  const sharer = new RecordingSharer();
  const ports: AppPorts = {
    clock: new FixedClock(NOW),
    random: new SeededRandom(7),
    profiles: new DexieProfileRepository(db),
    plans: new DexiePlanRepository(db),
    ratings: new DexieRatingRepository(db),
    progress: new DexieProgressRepository(db),
    quizBank: new InMemoryQuizRepository([]),
    quizState: new DexieQuizStateRepository(db),
    companion: new DexieCompanionRepository(db),
    shopping: new DexieShoppingRepository(db),
    settings: new DexieSettingsRepository(db),
    recipes: new InMemoryRecipeRepository(FIXTURE_RECIPES),
    photos: new InMemoryPhotoCatalog([]),
    exercises: catalog,
    sharer,
    userData: new DexieUserDataStore(db),
    cipher: new FakeCipher(),
    backupValidator: new ZodBackupValidator(),
    persistence: new FakePersistence(),
    fileSaver,
    ...dexieSportPorts(db),
  };
  return { db, ports, uc: createUseCases(ports), fileSaver, sharer };
}
type Env = ReturnType<typeof env>;

const input = (over: Partial<TrainingProfileInput>): TrainingProfileInput => ({
  ...defaultTrainingInput(),
  ...over,
});

interface Case {
  readonly name: string;
  readonly profile: Partial<Profile>;
  readonly training: Partial<TrainingProfileInput>;
}

const CASES: readonly Case[] = [
  { name: 'débutant à la maison, 3 séances', profile: {}, training: {} },
  {
    name: 'intermédiaire équipé, 4 séances de 45 min',
    profile: {},
    training: {
      frequency: 4,
      days: [0, 1, 3, 4],
      setting: 'maison-equipee',
      equipment: EQUIPMENT_BY_SETTING['maison-equipee'],
      level: 'intermediaire',
      goal: 'muscle',
      sessionMinutes: 45,
    },
  },
  {
    name: 'confirmé en salle, 6 séances de 60 min',
    profile: {},
    training: {
      frequency: 6,
      days: [0, 1, 2, 3, 4, 5],
      setting: 'salle',
      equipment: EQUIPMENT_BY_SETTING['salle'],
      level: 'confirme',
      goal: 'force',
      sessionMinutes: 60,
    },
  },
  {
    name: 'condition de santé, séance de 20 min',
    profile: { healthCondition: true },
    training: { frequency: 2, days: [0, 3], sessionMinutes: 20 },
  },
  { name: '72 ans', profile: { age: 72 }, training: { frequency: 3 } },
  { name: '16 ans', profile: { age: 16 }, training: { frequency: 3, goal: 'endurance' } },
  {
    name: 'grossesse, premier trimestre',
    profile: { sex: 'femme', pregnantOrBreastfeeding: true },
    training: { pregnancyStage: 'premier-trimestre' },
  },
  {
    name: 'post-partum, salle',
    profile: { sex: 'femme', pregnantOrBreastfeeding: true },
    training: {
      pregnancyStage: 'post-partum',
      setting: 'salle',
      equipment: EQUIPMENT_BY_SETTING['salle'],
      level: 'intermediaire',
    },
  },
];

describe('programme avec le vrai catalogue', { timeout: 60_000 }, () => {
  it.each(CASES)('$name : généré, jamais régénéré inutilement, séance jouable', async (c) => {
    const e = env();
    await e.uc.saveProfile(makeProfile(c.profile));
    expect((await e.uc.saveTrainingProfile(input(c.training))).status).toBe('saved');
    const first = await e.uc.getTrainingWeek();
    if (first.status !== 'ready') throw new Error(`programme attendu : ${first.status}`);
    expect(first.origin).toBe('generated');
    expect(first.plan.sessions.length).toBeGreaterThan(0);
    // Stable : un programme produit par le planificateur passe toujours les filtres durs.
    const second = await e.uc.getTrainingWeek();
    expect(second.status === 'ready' && second.origin).toBe('stored');
    expect(second.status === 'ready' && second.plan).toEqual(first.plan);

    // Une séance, du début à la fin, et le journal survit à la relecture.
    const session = first.plan.sessions.find((s) => s.main.length > 0);
    if (!session) throw new Error('séance attendue');
    const ref = { weekStart: first.plan.weekStart, sessionId: session.id };
    const started = await e.uc.startSession(ref);
    expect(started.status).toBe('ready');
    for (const item of session.main) await e.uc.markExerciseDone({ ...ref, slotId: item.slotId });
    const done = await e.uc.completeSession({ ...ref, effort: 'facile' });
    expect(done).toMatchObject({ status: 'completed', sessionsCompleted: 1 });
    const again = await e.uc.getTrainingWeek();
    expect(again.status === 'ready' && again.doneSessions).toBe(1);
    expect((await e.db.companion.get('current'))?.state.streak).toBe(1);
  });

  it('douleur : l’exercice est remplacé et le programme reste stable ensuite', async () => {
    const e = env();
    await e.uc.saveProfile(makeProfile());
    await e.uc.saveTrainingProfile(
      input({
        setting: 'maison-equipee',
        equipment: EQUIPMENT_BY_SETTING['maison-equipee'],
        level: 'intermediaire',
        frequency: 3,
      }),
    );
    const view = await e.uc.getTrainingWeek();
    if (view.status !== 'ready') throw new Error('programme attendu');
    const session = view.plan.sessions.find((s) => s.main.length > 0);
    const slot = session?.main[0];
    if (!session || !slot) throw new Error('séance attendue');
    const ref = { weekStart: view.plan.weekStart, sessionId: session.id, slotId: slot.slotId };
    await e.uc.startSession(ref);
    const result = await e.uc.reportPain(ref);
    if (result.status !== 'reported') throw new Error('signalement attendu');
    expect(result.replacement).toBeDefined();
    expect(result.messages.map((m) => m.code)).toEqual(['douleur', 'urgence']);
    const first = await e.uc.getTrainingWeek();
    const second = await e.uc.getTrainingWeek();
    expect(
      first.status === 'ready' && first.plan.sessions.flatMap((s) => s.main),
    ).not.toContainEqual(expect.objectContaining({ exerciseId: slot.exerciseId }));
    expect(second.status === 'ready' && second.origin).toBe('stored');
    expect(await e.db.painReports.count()).toBe(1);
  });
});

/** Parcours complet sur une base : profil, programme, séance, douleur, fin. */
async function populate(e: Env): Promise<void> {
  await e.uc.saveProfile(makeProfile());
  await e.uc.saveTrainingProfile(
    input({
      setting: 'maison-equipee',
      equipment: EQUIPMENT_BY_SETTING['maison-equipee'],
      level: 'intermediaire',
    }),
  );
  const view = await e.uc.getTrainingWeek();
  if (view.status !== 'ready') throw new Error('programme attendu');
  const session = view.plan.sessions.find((s) => s.main.length > 0);
  const slot = session?.main[0];
  if (!session || !slot) throw new Error('séance attendue');
  const ref = { weekStart: view.plan.weekStart, sessionId: session.id };
  await e.uc.startSession(ref);
  await e.uc.logSet({
    ...ref,
    slotId: slot.slotId,
    set: { index: 0, done: true, reps: 9, loadKg: 7.5 },
  });
  await e.uc.reportPain({ ...ref, slotId: slot.slotId });
  await e.uc.markExerciseDone({ ...ref, slotId: slot.slotId });
  await e.uc.completeSession({ ...ref, effort: 'correct' });
}

const sportData = async (e: Env) => {
  const { training, trainingPlans, sessionLogs, painReports } = await e.ports.userData.exportAll();
  return { training, trainingPlans, sessionLogs, painReports };
};

describe('sauvegarde du Sport avec Dexie et Zod', { timeout: 60_000 }, () => {
  it('4 → 4 : export, effacement total, import : les données reviennent à l’identique', async () => {
    const e = env();
    await populate(e);
    const before = await sportData(e);
    expect(before.training).toBeDefined();
    expect(before.sessionLogs).toHaveLength(1);
    expect(before.painReports).toHaveLength(1);
    expect(await e.uc.exportData()).toMatchObject({ status: 'exported' });
    const content = e.fileSaver.files[0]?.content ?? '';
    expect(JSON.parse(content)).toMatchObject({ schemaVersion: 4 });

    expect(await e.uc.wipeAllData()).toEqual({ status: 'wiped' });
    for (const table of [
      e.db.trainingProfile,
      e.db.trainingPlans,
      e.db.sessionLogs,
      e.db.painReports,
    ]) {
      expect(await table.count()).toBe(0);
    }
    expect(await e.uc.getTrainingProfile()).toEqual({ status: 'no-profile' });

    expect(await e.uc.importData({ content })).toMatchObject({ status: 'imported' });
    expect(await sportData(e)).toEqual(before);
    // Le programme importé est reconnu (même empreinte) : rien n'est régénéré.
    const week = await e.uc.getTrainingWeek();
    expect(week.status === 'ready' && week.origin).toBe('stored');
  });

  it('3 → 4 : une sauvegarde d’avant le Sport s’importe, le Sport reste désactivé', async () => {
    const source = env();
    await populate(source);
    await source.uc.exportData();
    const raw = JSON.parse(source.fileSaver.files[0]?.content ?? '') as Record<string, unknown>;
    const v3: Record<string, unknown> = Object.fromEntries(
      Object.entries(raw).filter(
        ([key]) => !['training', 'trainingPlans', 'sessionLogs', 'painReports'].includes(key),
      ),
    );
    v3['schemaVersion'] = 3;

    const target = env();
    await target.uc.saveProfile(makeProfile({ age: 60 }));
    await target.uc.saveTrainingProfile(defaultTrainingInput());
    expect(await target.uc.importData({ content: JSON.stringify(v3) })).toMatchObject({
      status: 'imported',
    });
    // L'import remplace tout, Sport compris : plus de profil sportif.
    expect(await target.uc.getTrainingProfile()).toMatchObject({
      status: 'inactive',
      askPregnancyStage: false,
    });
    expect(await sportData(target)).toEqual({
      training: undefined,
      trainingPlans: [],
      sessionLogs: [],
      painReports: [],
    });
    expect((await target.uc.getProfile())?.profile.age).toBe(makeProfile().age);
  });

  it('un fichier de Sport modifié est refusé sans rien changer', async () => {
    const e = env();
    await populate(e);
    await e.uc.exportData();
    const raw = JSON.parse(e.fileSaver.files[0]?.content ?? '') as {
      sessionLogs: { exercises: { sets: { reps?: number }[] }[] }[];
    };
    const set = raw.sessionLogs[0]?.exercises[0]?.sets[0];
    if (!set) throw new Error('série attendue');
    set.reps = 9_999;
    const before = await sportData(e);
    expect(await e.uc.importData({ content: JSON.stringify(raw) })).toMatchObject({
      status: 'invalid',
    });
    expect(await sportData(e)).toEqual(before);
  });
});
