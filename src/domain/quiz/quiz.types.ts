import type { IsoDate } from '../shared';
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

/** Question du jour et réponse éventuelle. */
export interface DailyQuiz {
  readonly date: IsoDate;
  readonly questionId: string;
  readonly answerIndex?: number;
}

/** État persistant du quiz. */
export interface QuizState {
  /** Questions déjà posées dans le cycle en cours (remis à zéro quand la banque est épuisée). */
  readonly seenIds: readonly string[];
  /** Série courante de bonnes réponses. */
  readonly streak: number;
  readonly bestStreak: number;
  readonly daily?: DailyQuiz;
}
