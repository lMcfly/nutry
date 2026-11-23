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
 * Question « du moment » : celle tirée pour une ouverture de l'app (session), et la
 * réponse éventuelle. La même session revoit la même question ; une nouvelle session en
 * tire une nouvelle.
 */
export interface QuizSessionQuestion {
  /** Identifiant opaque de la session (ouverture de l'app) qui a tiré la question. */
  readonly sessionId: string;
  readonly questionId: string;
  /** Présent si la personne a répondu. */
  readonly answerIndex?: number;
}

/** État persistant du quiz. */
export interface QuizState {
  /**
   * Questions RÉPONDUES dans le cycle en cours (remis à zéro quand la banque est
   * épuisée). Une question fermée sans réponse n'y figure pas : elle reste « non vue ».
   */
  readonly seenIds: readonly string[];
  /** Série courante de bonnes réponses consécutives (une question ignorée ne la casse pas). */
  readonly streak: number;
  readonly bestStreak: number;
  /** Dernière question tirée (session la plus récente). */
  readonly current?: QuizSessionQuestion;
}
