import { describe, expect, it } from 'vitest';
import { makeProfile } from '@domain/testing/fixtures';
import type { ProgressEntry } from '@domain/progress';
import { startOfWeek } from '@domain/shared';
import { NutryDatabase } from './NutryDatabase';
import {
  DexieProfileRepository,
  DexieProgressRepository,
  DexieQuizStateRepository,
  DexieUserDataStore,
} from './repositories';
import { DB_VERSIONS, SINGLETON_KEY } from './schema';
import type { DbVersion } from './schema';
import { fakeIndexedDb } from './testing';

const LATEST = DB_VERSIONS.at(-1);
const V1 = DB_VERSIONS.slice(0, 1);

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
  it('la version 2 est la version courante', () => {
    expect(DB_VERSIONS.map((v) => v.version)).toEqual([1, 2]);
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

    const v2 = new NutryDatabase({ ...idb, name: 'quiz' });
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
    const v2 = new NutryDatabase({ ...idb, name: 'quiz-repondu' });
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
    const upgraded = new NutryDatabase({ ...emptyIdb, name: 'vide' });
    await upgraded.open();
    expect(upgraded.verno).toBe(2);
    await expect(new DexieQuizStateRepository(upgraded).get()).resolves.toEqual({
      seenIds: [],
      streak: 0,
      bestStreak: 0,
    });
    upgraded.close();
  });
});
