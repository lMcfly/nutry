import { randomIndex } from '../shared';
import type { IsoDate, Rng } from '../shared';
import type { QuizQuestion, QuizState } from './quiz.types';

export const INITIAL_QUIZ_STATE: QuizState = { seenIds: [], streak: 0, bestStreak: 0 };

/** Part visée de questions de culture culinaire. */
export const CUISINE_SHARE = 0.2;

export interface DailyQuestion {
  readonly question: QuizQuestion;
  readonly state: QuizState;
  /** Réponse déjà donnée aujourd'hui, le cas échéant. */
  readonly answerIndex?: number;
}

/**
 * Question du jour. Même date → même question (réponse déjà donnée renvoyée).
 * Sinon : tirage parmi les questions pas encore vues du cycle (nouveau cycle quand
 * la banque est épuisée), en visant 20 % de cuisine : une question de cuisine est
 * choisie dès que la part de cuisine du cycle passerait sous 20 %, si possible.
 * Renvoie `undefined` si la banque est vide.
 */
export function pickDailyQuestion(
  questions: readonly QuizQuestion[],
  state: QuizState,
  today: IsoDate,
  rng: Rng,
): DailyQuestion | undefined {
  const byId = new Map(questions.map((q) => [q.id, q]));
  if (state.daily?.date === today) {
    const question = byId.get(state.daily.questionId);
    if (question) {
      return {
        question,
        state,
        ...(state.daily.answerIndex === undefined ? {} : { answerIndex: state.daily.answerIndex }),
      };
    }
  }
  if (questions.length === 0) return undefined;

  let seen = state.seenIds.filter((id) => byId.has(id));
  let remaining = questions.filter((q) => !seen.includes(q.id));
  if (remaining.length === 0) {
    seen = [];
    remaining = [...questions];
  }
  const cuisineSeen = seen.filter((id) => byId.get(id)?.category === 'cuisine').length;
  const wantCuisine = cuisineSeen < CUISINE_SHARE * (seen.length + 1);
  const preferred = remaining.filter((q) => (q.category === 'cuisine') === wantCuisine);
  const pool = preferred.length > 0 ? preferred : remaining;
  const question = pool[randomIndex(pool.length, rng)] as QuizQuestion;

  return {
    question,
    state: {
      ...state,
      seenIds: [...seen, question.id],
      daily: { date: today, questionId: question.id },
    },
  };
}

export interface QuizAnswer {
  readonly correct: boolean;
  readonly correctIndex: number;
  readonly explanation: string;
  readonly message: string;
  readonly state: QuizState;
}

/** Encouragement après une réponse (jamais de reproche). */
export function encouragement(correct: boolean, streak: number): string {
  if (!correct) return 'Pas grave : maintenant tu sais ! On remet ça demain ?';
  if (streak >= 5)
    return `Superbe série : ${streak} bonnes réponses d’affilée ! Ta curiosité fait des merveilles.`;
  if (streak >= 2) return `${streak} bonnes réponses d’affilée, continue comme ça !`;
  return 'Bonne réponse, bien joué !';
}

/**
 * Répond à la question. Bonne réponse : série + 1 ; mauvaise : série remise à 0.
 * Une question déjà répondue aujourd'hui renvoie le même résultat sans changer l'état.
 */
export function answerQuestion(
  question: QuizQuestion,
  state: QuizState,
  answerIndex: number,
  today: IsoDate,
): QuizAnswer {
  const daily = state.daily;
  const already =
    daily?.date === today && daily.questionId === question.id && daily.answerIndex !== undefined;
  const given = already ? (daily.answerIndex ?? answerIndex) : answerIndex;
  const correct = given === question.correctIndex;
  const streak = already ? state.streak : correct ? state.streak + 1 : 0;
  const nextState: QuizState = already
    ? state
    : {
        ...state,
        streak,
        bestStreak: Math.max(state.bestStreak, streak),
        daily: { date: today, questionId: question.id, answerIndex },
      };
  return {
    correct,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    message: encouragement(correct, streak),
    state: nextState,
  };
}
