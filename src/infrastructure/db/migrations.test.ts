import { describe, expect, it } from 'vitest';
import { makeProfile } from '@domain/testing/fixtures';
import type { ProgressEntry } from '@domain/progress';
import { startOfWeek } from '@domain/shared';
import { NutryDatabase } from './NutryDatabase';
import {
  DexieProfileRepository,
  DexieProgressRepository,
  DexieUserDataStore,
} from './repositories';
import { DB_VERSIONS } from './schema';
import type { DbVersion } from './schema';
import { fakeIndexedDb } from './testing';

/**
 * Une future version 2 imaginaire : nouvel index sur `progress` et donnée dérivée
 * calculée pour les mesures existantes. Elle prouve que la mécanique `DB_VERSIONS`
 * migre sans rien perdre.
 */
const FUTURE_V2: DbVersion = {
  version: 2,
  stores: { ...DB_VERSIONS[0]?.stores, progress: 'date, weekStart' },
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
  it('la version 1 est la version courante', () => {
    expect(DB_VERSIONS.map((v) => v.version)).toEqual([1]);
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
      versions: [...DB_VERSIONS, FUTURE_V2],
    });
    await v2.open();
    expect(v2.verno).toBe(2);
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
      ...FUTURE_V2,
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
    expect(again.verno).toBe(1);
    expect((await new DexieProfileRepository(again).get())?.age).toBe(41);
    again.close();
  });
});
