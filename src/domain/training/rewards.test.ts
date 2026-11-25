import { describe, expect, it } from 'vitest';
import {
  SPORT_ACCESSORY_UNLOCKS,
  completedSessionCount,
  newSportAccessories,
  nextSportAccessory,
  unlockedSportAccessories,
} from './rewards';
import type { SessionLog } from './training.types';

const log = (id: string, status: SessionLog['status']): SessionLog => ({
  id,
  weekStart: '2026-11-23',
  sessionId: id,
  date: '2026-11-23',
  status,
  startedAt: '2026-11-23T10:00:00.000Z',
  exercises: [],
});

describe('accessoires sportifs de Nutry', () => {
  it('seuils : bandeau 1, serviette 5, casquette 10, médaille 20', () => {
    expect(SPORT_ACCESSORY_UNLOCKS.map((a) => [a.id, a.sessions])).toEqual([
      ['bandeau', 1],
      ['serviette', 5],
      ['casquette', 10],
      ['medaille', 20],
    ]);
    expect(SPORT_ACCESSORY_UNLOCKS.map((a) => a.slot)).toEqual(['tete', 'cou', 'tete', 'cou']);
  });

  it('le nombre cumulé ne compte que les séances terminées', () => {
    expect(completedSessionCount([])).toBe(0);
    expect(
      completedSessionCount([log('a', 'terminee'), log('b', 'en-cours'), log('c', 'terminee')]),
    ).toBe(2);
  });

  it('rien ne se reperd : le déblocage ne dépend que du nombre', () => {
    expect(unlockedSportAccessories(0)).toEqual([]);
    expect(unlockedSportAccessories(5).map((a) => a.id)).toEqual(['bandeau', 'serviette']);
    expect(unlockedSportAccessories(99)).toHaveLength(4);
  });

  it('nouveautés entre deux nombres, et prochain accessoire', () => {
    expect(newSportAccessories(0, 1).map((a) => a.id)).toEqual(['bandeau']);
    expect(newSportAccessories(4, 10).map((a) => a.id)).toEqual(['serviette', 'casquette']);
    expect(newSportAccessories(10, 10)).toEqual([]);
    expect(nextSportAccessory(0)).toMatchObject({ remaining: 1 });
    expect(nextSportAccessory(7)).toMatchObject({ accessory: { id: 'casquette' }, remaining: 3 });
    expect(nextSportAccessory(20)).toBeUndefined();
  });
});
