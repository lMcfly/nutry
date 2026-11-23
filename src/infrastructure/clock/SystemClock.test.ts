import { describe, expect, it } from 'vitest';
import { SystemClock, localIsoDate } from './SystemClock';

describe('SystemClock', () => {
  it('donne l’instant courant et le jour local', () => {
    const clock = new SystemClock();
    const before = Date.now();
    expect(clock.now().getTime()).toBeGreaterThanOrEqual(before);
    expect(clock.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formate le jour local, pas le jour UTC', () => {
    // Construit avec les composantes locales : indépendant du fuseau de la machine.
    expect(localIsoDate(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
    expect(localIsoDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});
