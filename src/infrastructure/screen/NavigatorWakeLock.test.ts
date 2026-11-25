import { describe, expect, it, vi } from 'vitest';
import { NavigatorWakeLock } from './NavigatorWakeLock';

const sentinel = () => ({ release: vi.fn(() => Promise.resolve()) });

describe('NavigatorWakeLock', () => {
  it('sans l’API : repli silencieux', async () => {
    const lock = new NavigatorWakeLock(undefined);
    await expect(lock.acquire()).resolves.toBe(false);
    await expect(lock.release()).resolves.toBeUndefined();
  });

  it('demande un verrou d’écran puis le relâche une seule fois', async () => {
    const held = sentinel();
    const request = vi.fn(() => Promise.resolve(held));
    const lock = new NavigatorWakeLock({ request });
    await expect(lock.acquire()).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith('screen');
    await lock.release();
    await lock.release();
    expect(held.release).toHaveBeenCalledTimes(1);
  });

  it('un refus du navigateur n’est pas une erreur', async () => {
    const lock = new NavigatorWakeLock({ request: () => Promise.reject(new Error('refusé')) });
    await expect(lock.acquire()).resolves.toBe(false);
    await expect(lock.release()).resolves.toBeUndefined();
  });

  it('un verrou déjà relâché par le navigateur ne fait pas échouer le relâchement', async () => {
    const lock = new NavigatorWakeLock({
      request: () => Promise.resolve({ release: () => Promise.reject(new Error('déjà relâché')) }),
    });
    await lock.acquire();
    await expect(lock.release()).resolves.toBeUndefined();
  });
});
