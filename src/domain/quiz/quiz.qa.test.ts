/**
 * QA phase 2 — quiz : aucune répétition avant épuisement, nouveau cycle, même question
 * le même jour, série, part de cuisine.
 */
import { describe, expect, it } from 'vitest';
import { addDays, createSeededRng } from '../shared';
import { INITIAL_QUIZ_STATE, answerQuestion, pickDailyQuestion } from './index';
import type { QuizCategory, QuizQuestion, QuizState } from './index';

const q = (id: string, category: QuizCategory): QuizQuestion => ({
  id,
  question: `${id} ?`,
  choices: ['a', 'b', 'c', 'd'],
  correctIndex: 2,
  explanation: 'Parce que.',
  category,
  difficulty: 'moyen',
});

// 50 questions, dont 10 de cuisine (20 %).
const GENERAL: QuizCategory[] = ['histoire', 'geographie', 'sciences', 'arts', 'sport', 'nature'];
const BANK = [
  ...Array.from({ length: 40 }, (_, i) => q(`g${i}`, GENERAL[i % GENERAL.length] ?? 'histoire')),
  ...Array.from({ length: 10 }, (_, i) => q(`c${i}`, 'cuisine')),
];

function simulate(days: number, seed: number, bank = BANK) {
  const rng = createSeededRng(seed);
  let state: QuizState = INITIAL_QUIZ_STATE;
  const ids: string[] = [];
  for (let d = 0; d < days; d += 1) {
    const today = addDays('2026-01-01', d);
    const daily = pickDailyQuestion(bank, state, today, rng);
    if (!daily) throw new Error('banque vide');
    ids.push(daily.question.id);
    state = answerQuestion(daily.question, daily.state, d % 3 === 0 ? 0 : 2, today).state;
  }
  return { ids, state };
}

describe('QA quiz', () => {
  it('aucune répétition sur un cycle complet, 20 % de cuisine exactement', () => {
    for (const seed of [1, 2, 3, 42, 2026]) {
      const { ids } = simulate(BANK.length, seed);
      expect(new Set(ids).size).toBe(BANK.length);
      expect(ids.filter((id) => id.startsWith('c'))).toHaveLength(10);
      // Répartition régulière : au moins une question de cuisine par tranche de 10 jours.
      for (let k = 0; k < BANK.length; k += 10) {
        expect(ids.slice(k, k + 10).some((id) => id.startsWith('c'))).toBe(true);
      }
    }
  });

  it('nouveau cycle après épuisement, lui aussi sans répétition', () => {
    const { ids } = simulate(BANK.length * 2, 7);
    expect(new Set(ids.slice(BANK.length)).size).toBe(BANK.length);
  });

  it('jamais la même question deux jours de suite, même au changement de cycle', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const small = BANK.slice(0, 3);
      const { ids } = simulate(12, seed, small);
      for (let i = 1; i < ids.length; i += 1)
        expect(ids[i], `graine ${seed}, jour ${i}`).not.toBe(ids[i - 1]);
    }
  });

  it('une banque d’une seule question la repose chaque jour', () => {
    expect(simulate(3, 1, [q('seule', 'cuisine')]).ids).toEqual(['seule', 'seule', 'seule']);
  });

  it('même jour → même question, même sans réponse, et l’état n’avance pas', () => {
    const rng = createSeededRng(3);
    const first = pickDailyQuestion(BANK, INITIAL_QUIZ_STATE, '2026-03-01', rng);
    const again = pickDailyQuestion(BANK, first?.state ?? INITIAL_QUIZ_STATE, '2026-03-01', rng);
    expect(again?.question.id).toBe(first?.question.id);
    expect(again?.state.seenIds).toEqual(first?.state.seenIds);
  });

  it('série : +1 par bonne réponse, remise à 0 sur une erreur, meilleure série conservée', () => {
    let state: QuizState = INITIAL_QUIZ_STATE;
    const answers = [2, 2, 2, 0, 2];
    const streaks: number[] = [];
    answers.forEach((a, d) => {
      const today = addDays('2026-05-01', d);
      const daily = pickDailyQuestion(BANK, state, today, createSeededRng(d));
      if (!daily) throw new Error('vide');
      state = answerQuestion(daily.question, daily.state, a, today).state;
      streaks.push(state.streak);
    });
    expect(streaks).toEqual([1, 2, 3, 0, 1]);
    expect(state.bestStreak).toBe(3);
  });

  it('répondre deux fois le même jour ne change ni la série ni la réponse enregistrée', () => {
    const today = '2026-05-10';
    const daily = pickDailyQuestion(BANK, INITIAL_QUIZ_STATE, today, createSeededRng(1));
    if (!daily) throw new Error('vide');
    const first = answerQuestion(daily.question, daily.state, 2, today);
    const second = answerQuestion(daily.question, first.state, 0, today);
    expect(second.correct).toBe(true);
    expect(second.state).toBe(first.state);
    expect(second.state.streak).toBe(1);
  });

  it('les messages d’encouragement ne sont jamais culpabilisants', () => {
    for (let d = 0; d < 10; d += 1) {
      const daily = pickDailyQuestion(BANK, INITIAL_QUIZ_STATE, '2026-06-01', createSeededRng(d));
      if (!daily) throw new Error('vide');
      const wrong = answerQuestion(daily.question, daily.state, 0, '2026-06-01');
      expect(wrong.message).not.toMatch(/dommage|nul|raté|faux|erreur|mauvais/i);
    }
  });
});
