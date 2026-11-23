import { describe, expect, it, vi } from 'vitest';
import { NavigatorStoragePersistence } from './NavigatorStoragePersistence';

describe('NavigatorStoragePersistence', () => {
  it('relaie la réponse du navigateur', async () => {
    const storage = {
      persist: vi.fn(() => Promise.resolve(true)),
      persisted: () => Promise.resolve(true),
    };
    const persistence = new NavigatorStoragePersistence(storage);
    await expect(persistence.request()).resolves.toBe(true);
    await expect(persistence.isPersisted()).resolves.toBe(true);
    expect(storage.persist).toHaveBeenCalledOnce();
  });

  it('se replie sur false sans API ou en cas d’erreur', async () => {
    for (const storage of [undefined, {}]) {
      const persistence = new NavigatorStoragePersistence(storage);
      await expect(persistence.request()).resolves.toBe(false);
      await expect(persistence.isPersisted()).resolves.toBe(false);
    }
    const failing = new NavigatorStoragePersistence({
      persist: () => Promise.reject(new Error('refus')),
      persisted: () => Promise.reject(new Error('refus')),
    });
    await expect(failing.request()).resolves.toBe(false);
    await expect(failing.isPersisted()).resolves.toBe(false);
  });
});
