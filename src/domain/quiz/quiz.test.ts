import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../shared';
import {
  CUISINE_SHARE,
  INITIAL_QUIZ_STATE,
  answerQuestion,
  encouragement,
  pickDailyQuestion,
} from './index';
import type { QuizCategory, QuizQuestion, QuizState } from './index';

function question(id: string, category: QuizCategory = 'histoire'): QuizQuestion {
  return {
    id,
    question: `Question ${id} ?`,
    choices: ['a', 'b', 'c', 'd'],
    correctIndex: 1,
    explanation: `Parce que ${id}.`,
    category,
    difficulty: 'facile',
  };
}

// 10 questions dont 2 de cuisine (20 %).
const BANK: QuizQuestion[] = [
  ...Array.from({ length: 8 }, (_, k) => question(`g${k}`, k % 2 ? 'sciences' : 'histoire')),
  question('c0', 'cuisine'),
  question('c1', 'cuisine'),
];

function day(n: number): string {
  return `2026-12-${String(n).padStart(2, '0')}`;
}

describe('question du jour', () => {
  it('renvoie undefined pour une banque vide', () => {
    expect(pickDailyQuestion([], INITIAL_QUIZ_STATE, day(1), createSeededRng(1))).toBeUndefined();
  });

  it('repropose la même question le même jour, avec la réponse donnée', () => {
    const rng = createSeededRng(1);
    const first = pickDailyQuestion(BANK, INITIAL_QUIZ_STATE, day(1), rng);
    expect(first).toBeDefined();
    if (!first) return;
    const again = pickDailyQuestion(BANK, first.state, day(1), rng);
    expect(again?.question.id).toBe(first.question.id);
    expect(again?.state).toBe(first.state);
    expect(again?.answerIndex).toBeUndefined();
    const answered = answerQuestion(first.question, first.state, 2, day(1));
    expect(pickDailyQuestion(BANK, answered.state, day(1), rng)?.answerIndex).toBe(2);
  });

  it('ne répète aucune question avant épuisement, puis recommence un cycle', () => {
    const rng = createSeededRng(7);
    let state: QuizState = INITIAL_QUIZ_STATE;
    const ids: string[] = [];
    for (let d = 1; d <= 15; d += 1) {
      const picked = pickDailyQuestion(BANK, state, day(d), rng);
      if (!picked) throw new Error('banque vide');
      ids.push(picked.question.id);
      state = picked.state;
    }
    expect(new Set(ids.slice(0, 10)).size).toBe(10);
    expect(new Set(ids.slice(10)).size).toBe(5);
    expect(state.seenIds).toHaveLength(5);
  });

  it('vise environ 20 % de culture culinaire', () => {
    expect(CUISINE_SHARE).toBe(0.2);
    const rng = createSeededRng(3);
    let state: QuizState = INITIAL_QUIZ_STATE;
    const categories: string[] = [];
    for (let d = 1; d <= 10; d += 1) {
      const picked = pickDailyQuestion(BANK, state, day(d), rng);
      if (!picked) throw new Error('banque vide');
      categories.push(picked.question.category);
      state = picked.state;
    }
    // Une question de cuisine toutes les 5 : positions 1 et 6.
    expect(categories.map((c) => c === 'cuisine')).toEqual([
      true,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it('se rabat sur la culture générale si la cuisine est épuisée (et inversement)', () => {
    const onlyGeneral = [question('a'), question('b')];
    expect(
      pickDailyQuestion(onlyGeneral, INITIAL_QUIZ_STATE, day(1), createSeededRng(1))?.question
        .category,
    ).toBe('histoire');
    const onlyCuisine = [question('x', 'cuisine'), question('y', 'cuisine')];
    const first = pickDailyQuestion(onlyCuisine, INITIAL_QUIZ_STATE, day(1), createSeededRng(1));
    const second = first && pickDailyQuestion(onlyCuisine, first.state, day(2), createSeededRng(1));
    expect(second?.question.category).toBe('cuisine');
    expect(second?.question.id).not.toBe(first?.question.id);
  });

  it('ignore les identifiants vus qui ne sont plus dans la banque et une question du jour disparue', () => {
    const state: QuizState = {
      ...INITIAL_QUIZ_STATE,
      seenIds: ['ancienne', 'g0'],
      daily: { date: day(1), questionId: 'supprimee' },
    };
    const picked = pickDailyQuestion(BANK, state, day(1), createSeededRng(1));
    expect(picked?.question.id).not.toBe('g0');
    expect(picked?.state.seenIds[0]).toBe('g0');
  });
});

describe('réponse au quiz', () => {
  const q = question('g1');

  it('bonne réponse : série +1, record mis à jour', () => {
    const result = answerQuestion(
      q,
      { ...INITIAL_QUIZ_STATE, streak: 2, bestStreak: 2 },
      1,
      day(1),
    );
    expect(result).toMatchObject({ correct: true, correctIndex: 1, explanation: 'Parce que g1.' });
    expect(result.state).toMatchObject({
      streak: 3,
      bestStreak: 3,
      daily: { date: day(1), questionId: 'g1', answerIndex: 1 },
    });
    expect(result.message).toBe('3 bonnes réponses d’affilée, continue comme ça !');
  });

  it('mauvaise réponse : série remise à 0, record conservé, message encourageant', () => {
    const result = answerQuestion(
      q,
      { ...INITIAL_QUIZ_STATE, streak: 4, bestStreak: 6 },
      0,
      day(1),
    );
    expect(result.correct).toBe(false);
    expect(result.state).toMatchObject({ streak: 0, bestStreak: 6 });
    expect(result.message).toBe('Pas grave : maintenant tu sais ! On remet ça demain ?');
  });

  it('une question déjà répondue aujourd’hui renvoie le même résultat sans rien changer', () => {
    const first = answerQuestion(q, INITIAL_QUIZ_STATE, 1, day(1));
    const retry = answerQuestion(q, first.state, 3, day(1));
    expect(retry.correct).toBe(true);
    expect(retry.state).toBe(first.state);
    expect(retry.message).toBe(first.message);
    // Le lendemain, une nouvelle réponse compte.
    expect(answerQuestion(q, first.state, 1, day(2)).state.streak).toBe(2);
  });

  it('encourage selon la série', () => {
    expect(encouragement(true, 1)).toBe('Bonne réponse, bien joué !');
    expect(encouragement(true, 5)).toMatch(/^Superbe série : 5 bonnes réponses/);
    for (const text of [encouragement(false, 0), encouragement(true, 2)]) {
      expect(text).not.toMatch(/nul|raté|honte|mauvais/i);
    }
  });
});
