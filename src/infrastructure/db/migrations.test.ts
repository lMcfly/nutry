import { describe, expect, it } from 'vitest';
import { INITIAL_COMPANION_STATE } from '@domain/companion';
import { makeProfile } from '@domain/testing/fixtures';
import type { ProgressEntry } from '@domain/progress';
import { startOfWeek } from '@domain/shared';
import { NutryDatabase } from './NutryDatabase';
import {
  DexieCompanionRepository,
  DexieProfileRepository,
  DexieProgressRepository,
  DexieQuizStateRepository,
  DexieSessionLogRepository,
  DexieUserDataStore,
} from './repositories';
import { DB_VERSIONS, SINGLETON_KEY } from './schema';
import type { DbVersion } from './schema';
import { fakeIndexedDb } from './testing';

const LATEST = DB_VERSIONS.at(-1);
const V1 = DB_VERSIONS.slice(0, 1);
const V2 = DB_VERSIONS.slice(0, 2);
const V3 = DB_VERSIONS.slice(0, 3);

/**
 * Une future version imaginaire : nouvel index sur `progress` et donnée dérivée
 * calculée pour les mesures existantes. Elle prouve que la mécanique `DB_VERSIONS`
 * migre sans rien perdre.
 */
const FUTURE: DbVersion = {
  version: (LATEST?.version ?? 0) + 1,
  stores: { ...LATEST?.stores, progress: 'date, weekStart' },
  upgrade: async (tx) => {
    await tx
      .table<ProgressEntry & { weekStart?: string }>('progress')
      .toCollection()
      .modify((entry) => {
        entry.weekStart = startOfWeek(entry.date);
      });
  },
};

describe('migrations du schéma IndexedDB', () => {
  it('la version 4 est la version courante', () => {
    expect(DB_VERSIONS.map((v) => v.version)).toEqual([1, 2, 3, 4]);
    const versions = DB_VERSIONS.map((v) => v.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
  });

  it('une montée de version conserve et transforme les données', async () => {
    const idb = fakeIndexedDb();
    const v1 = new NutryDatabase({ ...idb, name: 'migration' });
    await new DexieProfileRepository(v1).save(makeProfile({ age: 41 }));
    await new DexieProgressRepository(v1).save({ date: '2026-11-25', weightKg: 62 });
    const before = await new DexieUserDataStore(v1).exportAll();
    v1.close();

    const v2 = new NutryDatabase({
      ...idb,
      name: 'migration',
      versions: [...DB_VERSIONS, FUTURE],
    });
    await v2.open();
    expect(v2.verno).toBe(FUTURE.version);
    // Données intactes…
    await expect(new DexieUserDataStore(v2).exportAll()).resolves.toMatchObject({
      ...before,
      progress: [{ date: '2026-11-25', weightKg: 62 }],
    });
    // … et transformées par la migration, interrogeables par le nouvel index.
    const migrated = await v2
      .table<ProgressEntry & { weekStart: string }>('progress')
      .where('weekStart')
      .equals('2026-11-23')
      .toArray();
    expect(migrated).toEqual([{ date: '2026-11-25', weightKg: 62, weekStart: '2026-11-23' }]);
    v2.close();
  });

  it('une migration qui échoue laisse la base dans sa version précédente', async () => {
    const idb = fakeIndexedDb();
    const v1 = new NutryDatabase({ ...idb, name: 'echec' });
    await new DexieProfileRepository(v1).save(makeProfile({ age: 41 }));
    v1.close();

    const failing: DbVersion = {
      ...FUTURE,
      upgrade: () => Promise.reject(new Error('migration ratée')),
    };
    const broken = new NutryDatabase({
      ...idb,
      name: 'echec',
      versions: [...DB_VERSIONS, failing],
    });
    await expect(broken.open()).rejects.toThrow();
    broken.close();

    const again = new NutryDatabase({ ...idb, name: 'echec' });
    await again.open();
    expect(again.verno).toBe(LATEST?.version);
    expect((await new DexieProfileRepository(again).get())?.age).toBe(41);
    again.close();
  });

  it('v1 → v2 : la question du jour devient la question de la dernière session', async () => {
    const idb = fakeIndexedDb();
    const v1 = new NutryDatabase({ ...idb, name: 'quiz', versions: V1 });
    await new DexieProfileRepository(v1).save(makeProfile({ age: 41 }));
    // Format v1, écrit tel quel (le type courant ne connaît plus `daily`).
    await v1.table('quiz').put({
      id: SINGLETON_KEY,
      state: {
        seenIds: ['q1', 'q2'],
        streak: 3,
        bestStreak: 5,
        daily: { date: '2026-11-22', questionId: 'q2' },
      },
    });
    v1.close();

    const v2 = new NutryDatabase({ ...idb, name: 'quiz', versions: V2 });
    await v2.open();
    expect(v2.verno).toBe(2);
    // Sans réponse, la question du jour redevient « non vue » ; série et record intacts.
    await expect(new DexieQuizStateRepository(v2).get()).resolves.toEqual({
      seenIds: ['q1'],
      streak: 3,
      bestStreak: 5,
      current: { sessionId: 'jour-2026-11-22', questionId: 'q2' },
    });
    expect((await new DexieProfileRepository(v2).get())?.age).toBe(41);
    v2.close();
  });

  it('v1 → v2 : un quiz vierge ou déjà répondu est conservé', async () => {
    const idb = fakeIndexedDb();
    const v1 = new NutryDatabase({ ...idb, name: 'quiz-repondu', versions: V1 });
    await v1.table('quiz').put({
      id: SINGLETON_KEY,
      state: {
        seenIds: ['q1'],
        streak: 1,
        bestStreak: 1,
        daily: { date: '2026-11-22', questionId: 'q1', answerIndex: 2 },
      },
    });
    v1.close();
    const v2 = new NutryDatabase({ ...idb, name: 'quiz-repondu', versions: V2 });
    await expect(new DexieQuizStateRepository(v2).get()).resolves.toEqual({
      seenIds: ['q1'],
      streak: 1,
      bestStreak: 1,
      current: { sessionId: 'jour-2026-11-22', questionId: 'q1', answerIndex: 2 },
    });
    v2.close();

    const emptyIdb = fakeIndexedDb();
    const empty = new NutryDatabase({ ...emptyIdb, name: 'vide', versions: V1 });
    await empty.open();
    empty.close();
    const upgraded = new NutryDatabase({ ...emptyIdb, name: 'vide', versions: V2 });
    await upgraded.open();
    expect(upgraded.verno).toBe(2);
    await expect(new DexieQuizStateRepository(upgraded).get()).resolves.toEqual({
      seenIds: [],
      streak: 0,
      bestStreak: 0,
    });
    upgraded.close();
  });

  it('v2 → v3 : la table du compagnon apparaît, les données existantes sont conservées', async () => {
    const idb = fakeIndexedDb();
    const v2 = new NutryDatabase({ ...idb, name: 'compagnon', versions: V2 });
    await new DexieProfileRepository(v2).save(makeProfile({ age: 41 }));
    await new DexieQuizStateRepository(v2).save({ seenIds: ['q1'], streak: 2, bestStreak: 4 });
    expect(v2.tables.map((t) => t.name)).not.toContain('companion');
    v2.close();

    const v3 = new NutryDatabase({ ...idb, name: 'compagnon', versions: V3 });
    await v3.open();
    expect(v3.verno).toBe(3);
    expect(v3.tables.map((t) => t.name)).toContain('companion');
    expect((await new DexieProfileRepository(v3).get())?.age).toBe(41);
    await expect(new DexieQuizStateRepository(v3).get()).resolves.toMatchObject({ bestStreak: 4 });
    // Pas de ligne : état initial ; puis l'état s'enregistre et se relit.
    const companion = new DexieCompanionRepository(v3);
    await expect(companion.get()).resolves.toEqual(INITIAL_COMPANION_STATE);
    const state = { ...INITIAL_COMPANION_STATE, lastActiveDay: '2026-11-23', streak: 1, best: 1 };
    await companion.save(state);
    await expect(companion.get()).resolves.toEqual(state);
    v3.close();
  });

  it('v1 → v3 directement : enchaîne les deux migrations', async () => {
    const idb = fakeIndexedDb();
    const v1 = new NutryDatabase({ ...idb, name: 'saut', versions: V1 });
    await v1.table('quiz').put({
      id: SINGLETON_KEY,
      state: {
        seenIds: [],
        streak: 0,
        bestStreak: 0,
        daily: { date: '2026-11-22', questionId: 'q1' },
      },
    });
    v1.close();
    const v3 = new NutryDatabase({ ...idb, name: 'saut', versions: V3 });
    await v3.open();
    expect(v3.verno).toBe(3);
    await expect(new DexieQuizStateRepository(v3).get()).resolves.toMatchObject({
      current: { sessionId: 'jour-2026-11-22' },
    });
    await expect(new DexieCompanionRepository(v3).get()).resolves.toEqual(INITIAL_COMPANION_STATE);
    v3.close();
  });

  it('v3 → v4 : les tables du Sport apparaissent vides, les données existantes sont conservées', async () => {
    const idb = fakeIndexedDb();
    const v3 = new NutryDatabase({ ...idb, name: 'sport', versions: V3 });
    await new DexieProfileRepository(v3).save(makeProfile({ age: 41 }));
    const companion = {
      ...INITIAL_COMPANION_STATE,
      lastActiveDay: '2026-11-23',
      streak: 2,
      best: 2,
    };
    await new DexieCompanionRepository(v3).save(companion);
    await new DexieProgressRepository(v3).save({ date: '2026-11-25', weightKg: 62 });
    const SPORT_TABLES = ['trainingProfile', 'trainingPlans', 'sessionLogs', 'painReports'];
    for (const name of SPORT_TABLES) expect(v3.tables.map((t) => t.name)).not.toContain(name);
    v3.close();

    const v4 = new NutryDatabase({ ...idb, name: 'sport' });
    await v4.open();
    expect(v4.verno).toBe(4);
    for (const name of SPORT_TABLES) expect(v4.tables.map((t) => t.name)).toContain(name);
    // Données de la version 3 intactes…
    expect((await new DexieProfileRepository(v4).get())?.age).toBe(41);
    await expect(new DexieCompanionRepository(v4).get()).resolves.toEqual(companion);
    await expect(new DexieProgressRepository(v4).list()).resolves.toEqual([
      { date: '2026-11-25', weightKg: 62 },
    ]);
    // … et le Sport n'est pas activé : aucune ligne, aucun profil sportif.
    const exported = await new DexieUserDataStore(v4).exportAll();
    expect(exported).toMatchObject({
      schemaVersion: 4,
      trainingPlans: [],
      sessionLogs: [],
      painReports: [],
    });
    expect(exported.training).toBeUndefined();
    // Les index prévus servent : semaine et date des journaux, date et exercice des douleurs.
    const sessionLogs = new DexieSessionLogRepository(v4);
    await sessionLogs.save({
      id: '2026-11-23:d0',
      weekStart: '2026-11-23',
      sessionId: 'd0',
      date: '2026-11-23',
      status: 'en-cours',
      startedAt: '2026-11-23T10:00:00.000Z',
      exercises: [],
    });
    expect(v4.sessionLogs.schema.idxByName['weekStart']).toBeDefined();
    expect(v4.sessionLogs.schema.idxByName['date']).toBeDefined();
    expect(v4.painReports.schema.idxByName['date']).toBeDefined();
    expect(v4.painReports.schema.idxByName['exerciseId']).toBeDefined();
    expect(v4.trainingPlans.schema.primKey.name).toBe('weekStart');
    expect(v4.trainingProfile.schema.primKey.name).toBe('id');
    v4.close();
  });

  it('v1 → v4 directement : les quatre versions s’enchaînent', async () => {
    const idb = fakeIndexedDb();
    const v1 = new NutryDatabase({ ...idb, name: 'tout', versions: V1 });
    await new DexieProfileRepository(v1).save(makeProfile({ age: 30 }));
    v1.close();
    const v4 = new NutryDatabase({ ...idb, name: 'tout' });
    await v4.open();
    expect(v4.verno).toBe(4);
    expect((await new DexieProfileRepository(v4).get())?.age).toBe(30);
    expect(v4.userTables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['trainingProfile', 'trainingPlans', 'sessionLogs', 'painReports']),
    );
    v4.close();
  });
});
