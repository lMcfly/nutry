import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { NutryDatabase } from './NutryDatabase';
import type { NutryDatabaseOptions } from './NutryDatabase';

/** IndexedDB en mémoire, isolée par test (fake-indexeddb). Réservé aux tests. */
export function fakeIndexedDb(): Pick<NutryDatabaseOptions, 'indexedDB' | 'IDBKeyRange'> {
  return { indexedDB: new IDBFactory(), IDBKeyRange };
}

export function createTestDatabase(options: NutryDatabaseOptions = {}): NutryDatabase {
  return new NutryDatabase({ ...fakeIndexedDb(), ...options });
}
