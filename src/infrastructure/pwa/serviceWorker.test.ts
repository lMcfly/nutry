import { describe, expect, it, vi } from 'vitest';
import type { registerSW } from 'virtual:pwa-register';
import { startServiceWorker } from './serviceWorker';

type Options = Parameters<typeof registerSW>[0] & object;

function fakeRegister() {
  const update = vi.fn(() => Promise.resolve());
  let options: Options = {};
  const register = vi.fn((o: Options = {}) => {
    options = o;
    return update;
  });
  return { register, update, options: () => options };
}

const registration = (waiting: boolean) =>
  ({ waiting: waiting ? {} : null }) as unknown as ServiceWorkerRegistration;

describe('startServiceWorker', () => {
  it('n’enregistre rien sans service worker', () => {
    const sw = fakeRegister();
    startServiceWorker(sw.register, { hasServiceWorker: false });
    expect(sw.register).not.toHaveBeenCalled();
  });

  it('enregistre immédiatement, sans rechargement sur une nouvelle version', () => {
    const sw = fakeRegister();
    startServiceWorker(sw.register, { hasServiceWorker: true });
    expect(sw.options().immediate).toBe(true);
    // Aucune réaction à une version arrivée en cours d'utilisation : elle attend.
    expect(sw.options().onNeedRefresh).toBeUndefined();
    sw.options().onRegisteredSW?.('sw.js', registration(false));
    sw.options().onRegisteredSW?.('sw.js', undefined);
    expect(sw.update).not.toHaveBeenCalled();
  });

  it('active au lancement une version qui attendait déjà', () => {
    const sw = fakeRegister();
    startServiceWorker(sw.register, { hasServiceWorker: true });
    sw.options().onRegisteredSW?.('sw.js', registration(true));
    expect(sw.update).toHaveBeenCalledWith(true);
  });
});
