import type { QuizQuestion, QuizState } from '@domain/quiz';

export interface QuizRepository {
  /** Banque de questions (embarquée, disponible hors ligne). */
  getQuestions(): Promise<readonly QuizQuestion[]>;
  /** État persistant : questions déjà vues, série en cours. */
  getState(): Promise<QuizState>;
  saveState(state: QuizState): Promise<void>;
}
