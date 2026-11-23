import { describe, expect, it } from 'vitest';
import { createInMemoryPorts } from '../testing';
import { createUseCases } from '.';
import { createSerialRunner } from './context';

describe('réglages', () => {
  it('lit et change le thème', async () => {
    const uc = createUseCases(createInMemoryPorts());
    await expect(uc.getSettings()).resolves.toEqual({ theme: 'system' });
    await expect(uc.setTheme('dark')).resolves.toEqual({ theme: 'dark' });
    await expect(uc.getSettings()).resolves.toEqual({ theme: 'dark' });
  });

  it('demande le stockage persistant et retient la réponse', async () => {
    const ports = createInMemoryPorts({ grantPersistence: true });
    const uc = createUseCases(ports);
    await expect(uc.isStoragePersisted()).resolves.toBe(false);
    await expect(uc.requestPersistentStorage()).resolves.toBe(true);
    await expect(uc.isStoragePersisted()).resolves.toBe(true);
    expect(ports.state.settings.persistenceGranted).toBe(true);

    const refused = createInMemoryPorts({ grantPersistence: false });
    await expect(createUseCases(refused).requestPersistentStorage()).resolves.toBe(false);
    expect(refused.state.settings.persistenceGranted).toBe(false);
  });
});

describe('createSerialRunner', () => {
  it('exécute les tâches une à une, même après un échec', async () => {
    const serial = createSerialRunner();
    const log: string[] = [];
    const task =
      (name: string, fail = false) =>
      async () => {
        log.push(`début ${name}`);
        await Promise.resolve();
        log.push(`fin ${name}`);
        if (fail) throw new Error(name);
        return name;
      };
    const results = await Promise.allSettled([
      serial(task('a')),
      serial(task('b', true)),
      serial(task('c')),
    ]);
    expect(log).toEqual(['début a', 'fin a', 'début b', 'fin b', 'début c', 'fin c']);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  });
});
