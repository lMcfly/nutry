/**
 * QA quiz : une nouvelle question à chaque ouverture (session), aucune répétition avant
 * épuisement, nouveau cycle, même question dans une même session, série de bonnes
 * réponses consécutives, part de cuisine.
 */
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../shared';
import { INITIAL_QUIZ_STATE, answerQuestion, pickNextQuestion } from './index';
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

const sid = (n: number) => `s-${n}`;

/** `opens` ouvertures ; `skip(n)` : la question de l'ouverture n est fermée sans réponse. */
function simulate(
  opens: number,
  seed: number,
  bank = BANK,
  skip: (n: number) => boolean = () => false,
) {
  const rng = createSeededRng(seed);
  let state: QuizState = INITIAL_QUIZ_STATE;
  const ids: string[] = [];
  const answered: string[] = [];
  for (let n = 0; n < opens; n += 1) {
    const picked = pickNextQuestion(bank, state, sid(n), rng);
    if (!picked) throw new Error('banque vide');
    ids.push(picked.question.id);
    state = picked.state;
    if (!skip(n)) {
      state = answerQuestion(picked.question, state, n % 3 === 0 ? 0 : 2, sid(n)).state;
      answered.push(picked.question.id);
    }
  }
  return { ids, answered, state };
}

describe('QA quiz', () => {
  it('aucune répétition sur un cycle complet, 20 % de cuisine exactement', () => {
    for (const seed of [1, 2, 3, 42, 2026]) {
      const { ids } = simulate(BANK.length, seed);
      expect(new Set(ids).size).toBe(BANK.length);
      expect(ids.filter((id) => id.startsWith('c'))).toHaveLength(10);
      // Répartition régulière : au moins une question de cuisine par tranche de 10.
      for (let k = 0; k < BANK.length; k += 10) {
        expect(ids.slice(k, k + 10).some((id) => id.startsWith('c'))).toBe(true);
      }
    }
  });

  it('nouveau cycle après épuisement, lui aussi sans répétition', () => {
    const { ids } = simulate(BANK.length * 2, 7);
    expect(new Set(ids.slice(BANK.length)).size).toBe(BANK.length);
  });

  it('jamais la même question deux ouvertures de suite, même au changement de cycle', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const small = BANK.slice(0, 3);
      const { ids } = simulate(12, seed, small, (n) => n % 4 === 1);
      for (let i = 1; i < ids.length; i += 1)
        expect(ids[i], `graine ${seed}, ouverture ${i}`).not.toBe(ids[i - 1]);
    }
  });

  it('les questions ignorées ne comptent pas : aucune réponse en double avant épuisement', () => {
    for (const seed of [1, 5, 9]) {
      // Une question sur trois est fermée sans réponse.
      const { answered } = simulate(BANK.length + 20, seed, BANK, (n) => n % 3 === 1);
      const cycle = answered.slice(0, BANK.length);
      expect(new Set(cycle).size).toBe(cycle.length);
    }
  });

  it('une banque d’une seule question la repose à chaque ouverture', () => {
    expect(simulate(3, 1, [q('seule', 'cuisine')]).ids).toEqual(['seule', 'seule', 'seule']);
  });

  it('même session → même question, même sans réponse, et l’état n’avance pas', () => {
    const rng = createSeededRng(3);
    const first = pickNextQuestion(BANK, INITIAL_QUIZ_STATE, 's-a', rng);
    const again = pickNextQuestion(BANK, first?.state ?? INITIAL_QUIZ_STATE, 's-a', rng);
    expect(again?.question.id).toBe(first?.question.id);
    expect(again?.state).toBe(first?.state);
  });

  it('série : bonnes réponses consécutives ; une erreur la remet à 0 ; ignorer ne la casse pas', () => {
    const rng = createSeededRng(11);
    let state: QuizState = INITIAL_QUIZ_STATE;
    // `undefined` : question fermée sans réponse.
    const answers = [2, 2, undefined, 2, 0, undefined, 2];
    const streaks: number[] = [];
    answers.forEach((a, n) => {
      const picked = pickNextQuestion(BANK, state, sid(n), rng);
      if (!picked) throw new Error('vide');
      state = picked.state;
      if (a !== undefined) state = answerQuestion(picked.question, state, a, sid(n)).state;
      streaks.push(state.streak);
    });
    expect(streaks).toEqual([1, 2, 2, 3, 0, 0, 1]);
    expect(state.bestStreak).toBe(3);
  });

  it('répondre deux fois dans la même session ne change ni la série ni la réponse', () => {
    const picked = pickNextQuestion(BANK, INITIAL_QUIZ_STATE, 's-x', createSeededRng(1));
    if (!picked) throw new Error('vide');
    const first = answerQuestion(picked.question, picked.state, 2, 's-x');
    const second = answerQuestion(picked.question, first.state, 0, 's-x');
    expect(second.correct).toBe(true);
    expect(second.state).toBe(first.state);
    expect(second.state.streak).toBe(1);
  });

  it('les messages d’encouragement ne sont jamais culpabilisants', () => {
    for (let n = 0; n < 10; n += 1) {
      const picked = pickNextQuestion(BANK, INITIAL_QUIZ_STATE, sid(n), createSeededRng(n));
      if (!picked) throw new Error('vide');
      const wrong = answerQuestion(picked.question, picked.state, 0, sid(n));
      expect(wrong.message).not.toMatch(/dommage|nul|raté|faux|erreur|mauvais/i);
    }
  });
});
