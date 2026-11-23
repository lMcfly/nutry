import type { QuizCategory, QuizDifficulty } from './quiz.constants';

export interface QuizQuestion {
  readonly id: string;
  readonly question: string;
  /** Exactement 4 propositions. */
  readonly choices: readonly [string, string, string, string];
  /** Index (0 à 3) de la bonne réponse dans `choices`. */
  readonly correctIndex: 0 | 1 | 2 | 3;
  /** Explication courte (1-2 phrases) affichée après la réponse. */
  readonly explanation: string;
  readonly category: QuizCategory;
  readonly difficulty: QuizDifficulty;
}

/**
 * PLACEHOLDER (phase 2) — état persistant du quiz.
 * À étoffer avec le cas d'usage GetDailyQuiz / AnswerQuiz.
 */
export interface QuizState {
  /** Questions déjà posées depuis le dernier épuisement de la banque. */
  readonly seenIds: readonly string[];
  /** Série courante de bonnes réponses. */
  readonly streak: number;
  readonly bestStreak: number;
}
