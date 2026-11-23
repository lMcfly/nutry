import type { StoragePersistence } from '@application/ports';

/** Sous-ensemble de `StorageManager` utilisé : injectable pour les tests. */
export interface PersistableStorage {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

/** `navigator.storage.persist()` / `persisted()`, avec repli sur `false`. */
export class NavigatorStoragePersistence implements StoragePersistence {
  constructor(private readonly storage: PersistableStorage | undefined) {}

  async request(): Promise<boolean> {
    try {
      return (await this.storage?.persist?.()) ?? false;
    } catch {
      return false;
    }
  }

  async isPersisted(): Promise<boolean> {
    try {
      return (await this.storage?.persisted?.()) ?? false;
    } catch {
      return false;
    }
  }
}
