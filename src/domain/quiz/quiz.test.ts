import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../shared';
import {
  CUISINE_SHARE,
  INITIAL_QUIZ_STATE,
  QUIZ_SESSION_PREFIX,
  answerQuestion,
  createQuizSessionId,
  encouragement,
  pickNextQuestion,
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

const session = (n: number) => `s-${n}`;

/** Ouvre `n` sessions de suite, en répondant (bien) à chaque question. */
function openAndAnswer(n: number, seed: number, bank = BANK) {
  const rng = createSeededRng(seed);
  let state: QuizState = INITIAL_QUIZ_STATE;
  const ids: string[] = [];
  for (let s = 1; s <= n; s += 1) {
    const picked = pickNextQuestion(bank, state, session(s), rng);
    if (!picked) throw new Error('banque vide');
    ids.push(picked.question.id);
    state = answerQuestion(picked.question, picked.state, 1, session(s)).state;
  }
  return { ids, state };
}

describe('identifiant de session', () => {
  it('est préfixé, de longueur fixe et différent d’un tirage à l’autre', () => {
    const rng = createSeededRng(5);
    const a = createQuizSessionId(rng);
    const b = createQuizSessionId(rng);
    expect(a.startsWith(QUIZ_SESSION_PREFIX)).toBe(true);
    expect(a).toHaveLength(QUIZ_SESSION_PREFIX.length + 20);
    expect(a).not.toBe(b);
    // Un tirage extrême (rng → 0) garde la longueur.
    expect(createQuizSessionId(() => 0)).toBe(`${QUIZ_SESSION_PREFIX}${'0'.repeat(20)}`);
  });
});

describe('question du moment', () => {
  it('renvoie undefined pour une banque vide', () => {
    expect(
      pickNextQuestion([], INITIAL_QUIZ_STATE, session(1), createSeededRng(1)),
    ).toBeUndefined();
  });

  it('même session → même question (et réponse donnée), état inchangé', () => {
    const rng = createSeededRng(1);
    const first = pickNextQuestion(BANK, INITIAL_QUIZ_STATE, session(1), rng);
    if (!first) throw new Error('vide');
    const again = pickNextQuestion(BANK, first.state, session(1), rng);
    expect(again?.question.id).toBe(first.question.id);
    expect(again?.state).toBe(first.state);
    expect(again?.answerIndex).toBeUndefined();
    const answered = answerQuestion(first.question, first.state, 2, session(1));
    expect(pickNextQuestion(BANK, answered.state, session(1), rng)?.answerIndex).toBe(2);
  });

  it('nouvelle session → nouvelle question, même sans réponse à la précédente', () => {
    const rng = createSeededRng(1);
    const first = pickNextQuestion(BANK, INITIAL_QUIZ_STATE, session(1), rng);
    if (!first) throw new Error('vide');
    const second = pickNextQuestion(BANK, first.state, session(2), rng);
    expect(second?.question.id).not.toBe(first.question.id);
    expect(second?.state.current).toEqual({
      sessionId: session(2),
      questionId: second?.question.id,
    });
  });

  it('tirer une question ne la marque pas comme vue ; répondre, si', () => {
    const picked = pickNextQuestion(BANK, INITIAL_QUIZ_STATE, session(1), createSeededRng(2));
    if (!picked) throw new Error('vide');
    expect(picked.state.seenIds).toEqual([]);
    const answered = answerQuestion(picked.question, picked.state, 0, session(1));
    expect(answered.state.seenIds).toEqual([picked.question.id]);
  });

  it('une question ignorée reste « non vue » et peut revenir plus tard', () => {
    const small = [question('a'), question('b')];
    const rng = createSeededRng(3);
    const first = pickNextQuestion(small, INITIAL_QUIZ_STATE, session(1), rng);
    if (!first) throw new Error('vide');
    // Session 2 : l'autre question, répondue.
    const second = pickNextQuestion(small, first.state, session(2), rng);
    if (!second) throw new Error('vide');
    expect(second.question.id).not.toBe(first.question.id);
    const answered = answerQuestion(second.question, second.state, 1, session(2)).state;
    // Session 3 : la question ignorée revient (seule non vue du cycle).
    const third = pickNextQuestion(small, answered, session(3), rng);
    expect(third?.question.id).toBe(first.question.id);
    expect(third?.state.seenIds).toEqual([second.question.id]);
  });

  it('ne répète aucune question répondue avant épuisement, puis recommence un cycle', () => {
    const { ids, state } = openAndAnswer(15, 7);
    expect(new Set(ids.slice(0, 10)).size).toBe(10);
    expect(new Set(ids.slice(10)).size).toBe(5);
    expect(state.seenIds).toHaveLength(5);
    // Pas la dernière question du cycle précédent en ouverture du nouveau cycle.
    expect(ids[10]).not.toBe(ids[9]);
  });

  it('vise environ 20 % de culture culinaire', () => {
    expect(CUISINE_SHARE).toBe(0.2);
    const { ids } = openAndAnswer(10, 3);
    const categories = ids.map((id) => BANK.find((q) => q.id === id)?.category);
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
      pickNextQuestion(onlyGeneral, INITIAL_QUIZ_STATE, session(1), createSeededRng(1))?.question
        .category,
    ).toBe('histoire');
    const onlyCuisine = [question('x', 'cuisine'), question('y', 'cuisine')];
    const { ids } = openAndAnswer(2, 1, onlyCuisine);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it('ignore les identifiants vus qui ne sont plus dans la banque et une question disparue', () => {
    const state: QuizState = {
      ...INITIAL_QUIZ_STATE,
      seenIds: ['ancienne', 'g0'],
      current: { sessionId: session(1), questionId: 'supprimee' },
    };
    const picked = pickNextQuestion(BANK, state, session(1), createSeededRng(1));
    expect(picked?.question.id).not.toBe('g0');
    expect(picked?.state.seenIds).toEqual(['g0']);
  });

  it('une banque d’une seule question la repose à chaque ouverture', () => {
    expect(openAndAnswer(3, 1, [question('seule', 'cuisine')]).ids).toEqual([
      'seule',
      'seule',
      'seule',
    ]);
  });
});

describe('réponse au quiz', () => {
  const q = question('g1');

  it('bonne réponse : série +1, record mis à jour, question vue', () => {
    const result = answerQuestion(
      q,
      { ...INITIAL_QUIZ_STATE, streak: 2, bestStreak: 2 },
      1,
      session(1),
    );
    expect(result).toMatchObject({ correct: true, correctIndex: 1, explanation: 'Parce que g1.' });
    expect(result.state).toMatchObject({
      seenIds: ['g1'],
      streak: 3,
      bestStreak: 3,
      current: { sessionId: session(1), questionId: 'g1', answerIndex: 1 },
    });
    expect(result.message).toBe('3 bonnes réponses d’affilée, continue comme ça !');
  });

  it('mauvaise réponse : série remise à 0, record conservé, message encourageant', () => {
    const result = answerQuestion(
      q,
      { ...INITIAL_QUIZ_STATE, streak: 4, bestStreak: 6 },
      0,
      session(1),
    );
    expect(result.correct).toBe(false);
    expect(result.state).toMatchObject({ streak: 0, bestStreak: 6 });
    expect(result.message).toBe(
      'Pas grave : maintenant tu sais ! Une autre question t’attend à ta prochaine visite.',
    );
  });

  it('une question déjà répondue dans la session renvoie le même résultat sans rien changer', () => {
    const first = answerQuestion(q, INITIAL_QUIZ_STATE, 1, session(1));
    const retry = answerQuestion(q, first.state, 3, session(1));
    expect(retry.correct).toBe(true);
    expect(retry.state).toBe(first.state);
    expect(retry.message).toBe(first.message);
    // Dans une autre session, une nouvelle réponse compte (sans doublon dans les vues).
    const later = answerQuestion(q, first.state, 1, session(2)).state;
    expect(later.streak).toBe(2);
    expect(later.seenIds).toEqual(['g1']);
  });

  it('encourage selon la série', () => {
    expect(encouragement(true, 1)).toBe('Bonne réponse, bien joué !');
    expect(encouragement(true, 5)).toMatch(/^Superbe série : 5 bonnes réponses/);
    for (const text of [encouragement(false, 0), encouragement(true, 2)]) {
      expect(text).not.toMatch(/nul|raté|honte|mauvais|demain/i);
    }
  });
});
