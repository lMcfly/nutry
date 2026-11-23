import { randomIndex } from '../shared';
import type { Rng } from '../shared';
import type { QuizQuestion, QuizState } from './quiz.types';

export const INITIAL_QUIZ_STATE: QuizState = { seenIds: [], streak: 0, bestStreak: 0 };

/** Part visée de questions de culture culinaire. */
export const CUISINE_SHARE = 0.2;

/** Préfixe des identifiants de session générés (`createQuizSessionId`). */
export const QUIZ_SESSION_PREFIX = 's-';

/**
 * Identifiant opaque d'une session (ouverture de l'app) : 4 tirages en base 36, environ
 * 2⁸⁰ valeurs. Il ne sert qu'à reconnaître « la même ouverture ».
 */
export function createQuizSessionId(rng: Rng): string {
  const part = () =>
    Math.floor(rng() * 36 ** 5)
      .toString(36)
      .padStart(5, '0');
  return `${QUIZ_SESSION_PREFIX}${part()}${part()}${part()}${part()}`;
}

export interface QuizPick {
  readonly question: QuizQuestion;
  readonly state: QuizState;
  /** Réponse déjà donnée pendant cette session, le cas échéant. */
  readonly answerIndex?: number;
}

/**
 * Question du moment pour la session `sessionId`.
 * - Même session → même question (et réponse déjà donnée), état inchangé.
 * - Nouvelle session → tirage parmi les questions pas encore répondues du cycle, sauf la
 *   question précédente (répondue ou ignorée) tant qu'il reste un autre choix. Quand
 *   tout a été répondu, nouveau cycle sans reposer la dernière question. On vise 20 % de
 *   cuisine : une question de cuisine est choisie dès que la part de cuisine parmi les
 *   questions répondues du cycle passerait sous 20 %, si possible.
 * Tirer une question ne la marque pas comme vue : seule une réponse le fait.
 * Renvoie `undefined` si la banque est vide.
 */
export function pickNextQuestion(
  questions: readonly QuizQuestion[],
  state: QuizState,
  sessionId: string,
  rng: Rng,
): QuizPick | undefined {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const current = state.current;
  if (current?.sessionId === sessionId) {
    const question = byId.get(current.questionId);
    if (question) {
      return {
        question,
        state,
        ...(current.answerIndex === undefined ? {} : { answerIndex: current.answerIndex }),
      };
    }
  }
  if (questions.length === 0) return undefined;

  let seen = state.seenIds.filter((id) => byId.has(id));
  let remaining = questions.filter((q) => !seen.includes(q.id));
  if (remaining.length === 0) {
    // Nouveau cycle : la dernière question répondue n'est pas reposée tout de suite.
    const last = seen.at(-1);
    seen = [];
    remaining = questions.length > 1 ? questions.filter((q) => q.id !== last) : [...questions];
  }
  // Jamais deux ouvertures de suite avec la même question, si un autre choix existe.
  const fresh = remaining.filter((q) => q.id !== current?.questionId);
  if (fresh.length > 0) remaining = fresh;

  const cuisineSeen = seen.filter((id) => byId.get(id)?.category === 'cuisine').length;
  const wantCuisine = cuisineSeen < CUISINE_SHARE * (seen.length + 1);
  const preferred = remaining.filter((q) => (q.category === 'cuisine') === wantCuisine);
  const pool = preferred.length > 0 ? preferred : remaining;
  const question = pool[randomIndex(pool.length, rng)] as QuizQuestion;
  return {
    question,
    state: { ...state, seenIds: seen, current: { sessionId, questionId: question.id } },
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
  if (!correct)
    return 'Pas grave : maintenant tu sais ! Une autre question t’attend à ta prochaine visite.';
  if (streak >= 5)
    return `Superbe série : ${streak} bonnes réponses d’affilée ! Ta curiosité fait des merveilles.`;
  if (streak >= 2) return `${streak} bonnes réponses d’affilée, continue comme ça !`;
  return 'Bonne réponse, bien joué !';
}

/**
 * Répond à la question de la session `sessionId`. Bonne réponse : série + 1 ; mauvaise :
 * série remise à 0. La question est alors comptée comme vue dans le cycle.
 * Une question déjà répondue dans cette session renvoie le même résultat sans changer
 * l'état.
 */
export function answerQuestion(
  question: QuizQuestion,
  state: QuizState,
  answerIndex: number,
  sessionId: string,
): QuizAnswer {
  const current = state.current;
  const already =
    current?.sessionId === sessionId &&
    current.questionId === question.id &&
    current.answerIndex !== undefined;
  const given = already ? (current.answerIndex ?? answerIndex) : answerIndex;
  const correct = given === question.correctIndex;
  const streak = already ? state.streak : correct ? state.streak + 1 : 0;
  const nextState: QuizState = already
    ? state
    : {
        ...state,
        seenIds: state.seenIds.includes(question.id)
          ? state.seenIds
          : [...state.seenIds, question.id],
        streak,
        bestStreak: Math.max(state.bestStreak, streak),
        current: { sessionId, questionId: question.id, answerIndex },
      };
  return {
    correct,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    message: encouragement(correct, streak),
    state: nextState,
  };
}
