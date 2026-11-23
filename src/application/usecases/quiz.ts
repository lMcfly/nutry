import { answerQuestion, createQuizSessionId, pickNextQuestion } from '@domain/quiz';
import type { QuizCategory, QuizQuestion, QuizState } from '@domain/quiz';
import { recordCompanionActivity } from './companion';
import type { ResolvedPorts, SerialRunner } from './context';
import { DEVICE_KEYS } from './settings';

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

/** Question du moment ; la bonne réponse n'est révélée qu'après une réponse. */
export interface QuizView {
  readonly questionId: string;
  readonly question: string;
  readonly choices: readonly [string, string, string, string];
  readonly category: QuizCategory;
  readonly streak: number;
  readonly bestStreak: number;
  /** Présent si la personne a déjà répondu pendant cette ouverture de l'app. */
  readonly answer?: QuizAnswerView;
}

export interface QuizUseCases {
  /**
   * Question du moment : une nouvelle à chaque ouverture de l'app (session de navigateur,
   * lancement de l'app installée), la même pendant toute la session, rechargements
   * compris. `undefined` si la banque est vide.
   */
  readonly getQuiz: () => Promise<QuizView | undefined>;
  /**
   * Répond à la question du moment. `undefined` si `questionId` n'est pas celle de la
   * session. Répondre à nouveau renvoie la première réponse, sans changer la série.
   */
  readonly answerQuiz: (input: {
    readonly questionId: string;
    readonly answerIndex: number;
  }) => Promise<QuizAnswerView | undefined>;
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

export function createQuizUseCases(ports: ResolvedPorts, serial: SerialRunner): QuizUseCases {
  const random = () => ports.random.next();

  /** Session en cours (portée `session` du stockage d'appareil), créée au premier appel. */
  const currentSessionId = (): string => {
    const existing = ports.device.get('session', DEVICE_KEYS.quizSessionId);
    if (existing) return existing;
    const created = createQuizSessionId(random);
    ports.device.set('session', DEVICE_KEYS.quizSessionId, created);
    return created;
  };

  return {
    getQuiz: () =>
      serial(async () => {
        const [questions, state] = await Promise.all([
          ports.quizBank.getQuestions(),
          ports.quizState.get(),
        ]);
        const sessionId = currentSessionId();
        const picked = pickNextQuestion(questions, state, sessionId, random);
        if (!picked) return undefined;
        if (picked.state !== state) await ports.quizState.save(picked.state);
        const { question } = picked;
        let answer: QuizAnswerView | undefined;
        if (picked.answerIndex !== undefined) {
          const replay = answerQuestion(question, picked.state, picked.answerIndex, sessionId);
          answer = toAnswerView(
            question,
            picked.state,
            picked.answerIndex,
            replay.message,
            replay.correct,
          );
        }
        return {
          questionId: question.id,
          question: question.question,
          choices: question.choices,
          category: question.category,
          streak: picked.state.streak,
          bestStreak: picked.state.bestStreak,
          ...(answer ? { answer } : {}),
        };
      }),

    answerQuiz: ({ questionId, answerIndex }) =>
      serial(async () => {
        const state = await ports.quizState.get();
        const sessionId = ports.device.get('session', DEVICE_KEYS.quizSessionId);
        const current = state.current;
        if (!sessionId || current?.sessionId !== sessionId || current.questionId !== questionId) {
          return undefined;
        }
        const questions = await ports.quizBank.getQuestions();
        const question = questions.find((q) => q.id === questionId);
        if (!question) return undefined;
        const result = answerQuestion(question, state, answerIndex, sessionId);
        if (result.state !== state) {
          await ports.quizState.save(result.state);
          await recordCompanionActivity(ports);
        }
        return toAnswerView(
          question,
          result.state,
          result.state.current?.answerIndex ?? answerIndex,
          result.message,
          result.correct,
        );
      }),
  };
}
