import { describe, expect, it } from 'vitest';
import { WebDeviceStorage, browserDeviceStorages } from './WebDeviceStorage';
import type { KeyValueStorage } from './WebDeviceStorage';

class MapStorage implements KeyValueStorage {
  readonly items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

const throwing = (): KeyValueStorage => {
  throw new Error('SecurityError');
};

describe('WebDeviceStorage', () => {
  it('lit et écrit avec le préfixe nutry., dans la bonne portée', () => {
    const local = new MapStorage();
    const session = new MapStorage();
    const storage = new WebDeviceStorage({ local: () => local, session: () => session });
    storage.set('local', 'theme', 'dark');
    storage.set('session', 'quiz.session', '1');
    expect(local.items.get('nutry.theme')).toBe('dark');
    expect(session.items.get('nutry.quiz.session')).toBe('1');
    expect(storage.get('local', 'theme')).toBe('dark');
    expect(storage.get('local', 'quiz.session')).toBeUndefined();
  });

  it('« clear » n’efface que les clés de Nutry, dans les deux portées', () => {
    const local = new MapStorage();
    const session = new MapStorage();
    local.setItem('autre-site', 'garde');
    local.setItem('nutry.theme', 'dark');
    local.setItem('nutry.ancienne-cle', 'x');
    session.setItem('nutry.quiz.session', '1');
    const storage = new WebDeviceStorage({ local: () => local, session: () => session });
    storage.clear();
    expect([...local.items.keys()]).toEqual(['autre-site']);
    expect(session.items.size).toBe(0);
    expect(storage.get('local', 'theme')).toBeUndefined();
  });

  it('se replie en mémoire si le stockage est indisponible, sans jamais lever', () => {
    const storage = new WebDeviceStorage({ local: throwing, session: () => undefined });
    expect(storage.get('local', 'theme')).toBeUndefined();
    storage.set('local', 'theme', 'light');
    storage.set('session', 'quiz.session', '1');
    expect(storage.get('local', 'theme')).toBe('light');
    expect(storage.get('session', 'quiz.session')).toBe('1');
    expect(() => {
      storage.clear();
    }).not.toThrow();
    expect(storage.get('session', 'quiz.session')).toBeUndefined();
  });

  it('branche les stockages de la fenêtre', () => {
    const local = new MapStorage();
    const session = new MapStorage();
    const accessors = browserDeviceStorages({
      localStorage: local as unknown as Storage,
      sessionStorage: session as unknown as Storage,
    });
    expect(accessors.local()).toBe(local);
    expect(accessors.session()).toBe(session);
  });
});
