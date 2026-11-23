import type { QuizQuestion, QuizState } from '@domain/quiz';

/** Banque de questions (embarquée, lecture seule, disponible hors ligne). */
export interface QuizRepository {
  getQuestions(): Promise<readonly QuizQuestion[]>;
}

/** État persistant du quiz : questions déjà vues, série en cours, question du jour. */
export interface QuizStateRepository {
  /** `INITIAL_QUIZ_STATE` si rien n'est encore enregistré. */
  get(): Promise<QuizState>;
  save(state: QuizState): Promise<void>;
}
