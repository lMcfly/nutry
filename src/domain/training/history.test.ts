import { describe, expect, it } from 'vitest';
import { sessionHistory } from './history';
import type { SessionLog, WeeklyTrainingPlan } from './training.types';

const log = (over: Partial<SessionLog> & Pick<SessionLog, 'id' | 'date'>): SessionLog => ({
  weekStart: '2026-11-23',
  sessionId: over.id.split(':')[1] ?? 'd0',
  status: 'terminee',
  startedAt: `${over.date}T10:00:00.000Z`,
  exercises: [],
  ...over,
});

describe('sessionHistory', () => {
  const plan = {
    weekStart: '2026-11-23',
    sessions: [{ id: 'd0', title: 'Corps entier A' }],
  } as unknown as WeeklyTrainingPlan;

  it('trie du plus récent au plus ancien et compte les séries faites', () => {
    const entries = sessionHistory(
      [
        log({
          id: '2026-11-23:d0',
          date: '2026-11-23',
          effort: 'correct',
          exercises: [
            {
              slotId: 'a',
              exerciseId: 'x',
              done: true,
              sets: [
                { index: 0, done: false },
                { index: 1, done: false },
              ],
            },
            {
              slotId: 'b',
              exerciseId: 'y',
              done: false,
              sets: [
                { index: 0, done: true },
                { index: 1, done: false },
              ],
            },
          ],
        }),
        log({ id: '2026-11-23:d2', date: '2026-11-25', status: 'en-cours' }),
        log({ id: '2026-11-16:d1', date: '2026-11-25', weekStart: '2026-11-16' }),
      ],
      [plan],
    );
    expect(entries.map((e) => e.id)).toEqual(['2026-11-23:d2', '2026-11-16:d1', '2026-11-23:d0']);
    const first = entries[2];
    expect(first).toMatchObject({
      title: 'Corps entier A',
      exerciseCount: 2,
      doneSets: 3,
      effort: 'correct',
    });
    expect(entries[0]?.title).toBeUndefined();
    expect(entries[0]?.effort).toBeUndefined();
  });
});
