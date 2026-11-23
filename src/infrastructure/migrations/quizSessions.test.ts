import { describe, expect, it } from 'vitest';
import { LEGACY_QUIZ_SESSION_PREFIX, migrateQuizStateToSessions } from './quizSessions';

describe('migration du quiz : question du jour → question à chaque ouverture', () => {
  it('question du jour répondue : reste vue, devient la question courante', () => {
    expect(
      migrateQuizStateToSessions({
        seenIds: ['a', 'b'],
        streak: 2,
        bestStreak: 4,
        daily: { date: '2026-11-20', questionId: 'b', answerIndex: 3 },
      }),
    ).toEqual({
      seenIds: ['a', 'b'],
      streak: 2,
      bestStreak: 4,
      current: {
        sessionId: `${LEGACY_QUIZ_SESSION_PREFIX}2026-11-20`,
        questionId: 'b',
        answerIndex: 3,
      },
    });
  });

  it('question du jour sans réponse : redevient « non vue », série intacte', () => {
    expect(
      migrateQuizStateToSessions({
        seenIds: ['a', 'b'],
        streak: 1,
        bestStreak: 1,
        daily: { date: '2026-11-20', questionId: 'b' },
      }),
    ).toEqual({
      seenIds: ['a'],
      streak: 1,
      bestStreak: 1,
      current: { sessionId: 'jour-2026-11-20', questionId: 'b' },
    });
  });

  it('rend tel quel un état sans question du jour, et ne lève jamais', () => {
    const state = { seenIds: ['a'], streak: 0, bestStreak: 0 };
    expect(migrateQuizStateToSessions(state)).toBe(state);
    for (const raw of [null, 42, 'x', [], undefined]) {
      expect(migrateQuizStateToSessions(raw)).toBe(raw);
    }
    // `daily` illisible : simplement retiré.
    expect(migrateQuizStateToSessions({ ...state, daily: 'x' })).toEqual(state);
    expect(migrateQuizStateToSessions({ ...state, daily: { date: 3 } })).toEqual(state);
    // Champs inattendus : `seenIds` absent, date non textuelle.
    expect(migrateQuizStateToSessions({ daily: { date: 7, questionId: 'q' } })).toEqual({
      current: { sessionId: 'jour-', questionId: 'q' },
    });
  });
});
