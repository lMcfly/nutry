import { answerQuestion, pickDailyQuestion } from '@domain/quiz';
import type { QuizCategory, QuizQuestion, QuizState } from '@domain/quiz';
import type { AppPorts, SerialRunner } from './context';

/** Résultat d'une réponse. */
export interface QuizAnswerView {
  readonly answerIndex: number;
  readonly correct: boolean;
  readonly correctIndex: number;
  readonly explanation: string;
  readonly message: string;
  readonly streak: number;
  readonly bestStreak: number;
}

/** Question du jour ; la bonne réponse n'est révélée qu'après une réponse. */
export interface DailyQuizView {
  readonly questionId: string;
  readonly question: string;
  readonly choices: readonly [string, string, string, string];
  readonly category: QuizCategory;
  readonly streak: number;
  readonly bestStreak: number;
  /** Présent si la personne a déjà répondu aujourd'hui. */
  readonly answer?: QuizAnswerView;
}

export interface QuizUseCases {
  /** Question du jour (la même toute la journée) ; `undefined` si la banque est vide. */
  getDailyQuiz(): Promise<DailyQuizView | undefined>;
  /**
   * Répond à la question du jour. `undefined` si `questionId` n'est pas celle du jour.
   * Répondre à nouveau renvoie la première réponse, sans changer la série.
   */
  answerQuiz(input: {
    readonly questionId: string;
    readonly answerIndex: number;
  }): Promise<QuizAnswerView | undefined>;
}

function toAnswerView(
  question: QuizQuestion,
  state: QuizState,
  answerIndex: number,
  message: string,
  correct: boolean,
): QuizAnswerView {
  return {
    answerIndex,
    correct,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    message,
    streak: state.streak,
    bestStreak: state.bestStreak,
  };
}

export function createQuizUseCases(ports: AppPorts, serial: SerialRunner): QuizUseCases {
  return {
    getDailyQuiz: () =>
      serial(async () => {
        const [questions, state] = await Promise.all([
          ports.quizBank.getQuestions(),
          ports.quizState.get(),
        ]);
        const today = ports.clock.today();
        const daily = pickDailyQuestion(questions, state, today, () => ports.random.next());
        if (!daily) return undefined;
        if (daily.state !== state) await ports.quizState.save(daily.state);
        const { question } = daily;
        let answer: QuizAnswerView | undefined;
        if (daily.answerIndex !== undefined) {
          const replay = answerQuestion(question, daily.state, daily.answerIndex, today);
          answer = toAnswerView(
            question,
            daily.state,
            daily.answerIndex,
            replay.message,
            replay.correct,
          );
        }
        return {
          questionId: question.id,
          question: question.question,
          choices: question.choices,
          category: question.category,
          streak: daily.state.streak,
          bestStreak: daily.state.bestStreak,
          ...(answer ? { answer } : {}),
        };
      }),

    answerQuiz: ({ questionId, answerIndex }) =>
      serial(async () => {
        const state = await ports.quizState.get();
        const today = ports.clock.today();
        if (state.daily?.date !== today || state.daily.questionId !== questionId) return undefined;
        const questions = await ports.quizBank.getQuestions();
        const question = questions.find((q) => q.id === questionId);
        if (!question) return undefined;
        const result = answerQuestion(question, state, answerIndex, today);
        if (result.state !== state) await ports.quizState.save(result.state);
        return toAnswerView(
          question,
          result.state,
          result.state.daily?.answerIndex ?? answerIndex,
          result.message,
          result.correct,
        );
      }),
  };
}
