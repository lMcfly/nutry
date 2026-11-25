import { describe, expect, it } from 'vitest';
import { addDays } from '../shared';
import { DELOAD_EVERY_WEEKS, TRAINING_LEVELS, computeCycle, type TrainingLevel } from '.';

const START = '2026-01-05'; // un lundi
const week = (n: number) => addDays(START, 7 * n);
const weeksDone = (count: number, from = 0) =>
  Array.from({ length: count }, (_, i) => week(from + i));
const cycle = (level: TrainingLevel, at: number, done: readonly string[]) =>
  computeCycle({ level, weekStart: week(at), completedWeekStarts: done });

describe('computeCycle : blocs et semaine allégée', () => {
  it.each(TRAINING_LEVELS)('%s : la dernière semaine de chaque bloc est allégée', (level) => {
    const length = DELOAD_EVERY_WEEKS[level];
    for (let active = 0; active < length * 3; active += 1) {
      const info = cycle(level, active, weeksDone(active));
      expect(info.activeWeeks).toBe(active);
      expect(info.blockLength).toBe(length);
      expect(info.blockIndex).toBe(Math.floor(active / length));
      expect(info.weekInBlock).toBe((active % length) + 1);
      expect(info.deload).toBe(info.weekInBlock === length);
      if (info.deload) expect(info.deloadReason).toBe('cycle');
      else expect(info.deloadReason).toBeUndefined();
    }
  });

  it('vaut 6, 5 et 4 semaines selon le niveau', () => {
    expect(cycle('debutant', 5, weeksDone(5)).deload).toBe(true);
    expect(cycle('debutant', 4, weeksDone(4)).deload).toBe(false);
    expect(cycle('intermediaire', 4, weeksDone(4)).deload).toBe(true);
    expect(cycle('confirme', 3, weeksDone(3)).deload).toBe(true);
  });

  it('commence à la première semaine sans historique, sans reprise', () => {
    const info = cycle('intermediaire', 0, []);
    expect(info).toEqual({
      activeWeeks: 0,
      blockIndex: 0,
      weekInBlock: 1,
      blockLength: 5,
      deload: false,
    });
  });

  it('compte une semaine une seule fois, quel que soit le nombre de séances, et normalise au lundi', () => {
    const info = cycle('intermediaire', 3, [week(0), week(0), addDays(week(1), 2), week(2)]);
    expect(info.activeWeeks).toBe(3);
  });

  it('ignore la semaine courante et les suivantes (le calcul ne dépend que du passé)', () => {
    const before = cycle('intermediaire', 2, weeksDone(2));
    expect(cycle('intermediaire', 2, [...weeksDone(2), week(2), week(3)])).toEqual(before);
  });

  it('ne fait pas avancer le cycle pendant une pause : seules les semaines actives comptent', () => {
    const info = cycle('intermediaire', 10, [week(0), week(1), week(2)]);
    expect(info.activeWeeks).toBe(3);
    expect(info.weekInBlock).toBe(4);
  });
});

describe('computeCycle : reprise', () => {
  it('allège la semaine après deux semaines entières sans séance', () => {
    const info = cycle('intermediaire', 4, [week(0), week(1)]);
    expect(info.deload).toBe(true);
    expect(info.deloadReason).toBe('reprise');
    expect(info.activeWeeks).toBe(2);
  });

  it('ne déclenche pas la reprise après une seule semaine sans séance', () => {
    expect(cycle('intermediaire', 3, [week(0), week(1)]).deload).toBe(false);
    expect(cycle('intermediaire', 2, [week(0), week(1)]).deload).toBe(false);
  });

  it('reprend au bon cycle ensuite : la semaine de reprise faite compte comme semaine active', () => {
    const afterBreak = cycle('intermediaire', 5, [week(0), week(1), week(4)]);
    expect(afterBreak.deload).toBe(false);
    expect(afterBreak.activeWeeks).toBe(3);
  });

  it('donne la priorité à la reprise sur l’allègement du cycle', () => {
    const done = weeksDone(4);
    const info = cycle('intermediaire', 4 + 3, done);
    expect(info.weekInBlock).toBe(5);
    expect(info.deloadReason).toBe('reprise');
  });
});
