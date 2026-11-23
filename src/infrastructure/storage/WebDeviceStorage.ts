import type { DeviceStorage, DeviceStorageScope } from '@application/ports';

/** Préfixe de toutes les clés de Nutry dans `localStorage` / `sessionStorage`. */
export const DEVICE_KEY_PREFIX = 'nutry.';

/** Sous-ensemble de `Storage` utilisé : injectable pour les tests. */
export interface KeyValueStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Accès aux stockages du navigateur, qui peuvent lever (navigation privée stricte…). */
export type StorageAccessor = () => KeyValueStorage | undefined;

/**
 * `localStorage` / `sessionStorage`, clés préfixées `nutry.`. Jamais d'exception : en cas
 * d'échec, repli en mémoire (valable jusqu'au rechargement de la page).
 */
export class WebDeviceStorage implements DeviceStorage {
  private readonly memory: Record<DeviceStorageScope, Map<string, string>> = {
    local: new Map(),
    session: new Map(),
  };

  constructor(private readonly storages: Readonly<Record<DeviceStorageScope, StorageAccessor>>) {}

  get(scope: DeviceStorageScope, key: string): string | undefined {
    const fallback = this.memory[scope].get(key);
    try {
      return this.storages[scope]()?.getItem(DEVICE_KEY_PREFIX + key) ?? fallback;
    } catch {
      return fallback;
    }
  }

  set(scope: DeviceStorageScope, key: string, value: string): void {
    this.memory[scope].set(key, value);
    try {
      this.storages[scope]()?.setItem(DEVICE_KEY_PREFIX + key, value);
    } catch {
      // Stockage indisponible ou plein : le repli en mémoire suffit.
    }
  }

  clear(): void {
    for (const scope of ['local', 'session'] as const) {
      this.memory[scope].clear();
      try {
        const storage = this.storages[scope]();
        if (!storage) continue;
        const keys: string[] = [];
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i);
          if (key?.startsWith(DEVICE_KEY_PREFIX)) keys.push(key);
        }
        for (const key of keys) storage.removeItem(key);
      } catch {
        // Rien à effacer si le stockage est inaccessible.
      }
    }
  }
}

/** Les stockages de la fenêtre, lus à chaque accès (l'accès lui-même peut lever). */
export function browserDeviceStorages(
  win: Pick<Window, 'localStorage' | 'sessionStorage'>,
): Record<DeviceStorageScope, StorageAccessor> {
  return {
    local: () => win.localStorage,
    session: () => win.sessionStorage,
  };
}
