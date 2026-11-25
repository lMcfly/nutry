import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { FakeScreenWakeLock } from '@application/testing';
import { NutryDatabase } from './NutryDatabase';
import type { NutryDatabaseOptions } from './NutryDatabase';
import {
  DexiePainReportRepository,
  DexieSessionLogRepository,
  DexieTrainingRepository,
} from './repositories';

/** IndexedDB en mémoire, isolée par test (fake-indexeddb). Réservé aux tests. */
export function fakeIndexedDb(): Pick<NutryDatabaseOptions, 'indexedDB' | 'IDBKeyRange'> {
  return { indexedDB: new IDBFactory(), IDBKeyRange };
}

export function createTestDatabase(options: NutryDatabaseOptions = {}): NutryDatabase {
  return new NutryDatabase({ ...fakeIndexedDb(), ...options });
}

/** Ports du Sport adossés à la base (Dexie), verrou d'écran factice : pour les tests d'intégration. */
export function dexieSportPorts(db: NutryDatabase) {
  return {
    training: new DexieTrainingRepository(db),
    sessionLogs: new DexieSessionLogRepository(db),
    painReports: new DexiePainReportRepository(db),
    wakeLock: new FakeScreenWakeLock(),
  };
}
