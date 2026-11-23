/**
 * Passage du quiz « question du jour » (`QuizState.daily`, base v1 et sauvegardes v1) au
 * quiz « une question à chaque ouverture » (`QuizState.current`, ADR 0011).
 *
 * Travaille sur des données brutes (base IndexedDB ou fichier importé, non fiable) : ne
 * lève jamais, ne recopie que les champs connus de `daily`, et laisse le reste intact
 * (le schéma Zod de la sauvegarde valide ensuite le résultat).
 */

/** Préfixe des sessions issues d'une ancienne question du jour (jamais généré ailleurs). */
export const LEGACY_QUIZ_SESSION_PREFIX = 'jour-';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * - `daily` disparaît, remplacé par `current` (session `jour-AAAA-MM-JJ`, qui ne correspond
 *   à aucune ouverture réelle : la prochaine ouverture tire une nouvelle question, différente
 *   de celle-ci).
 * - Une question du jour restée SANS réponse redevient « non vue » (retirée de `seenIds`),
 *   comme une question fermée sans réponse dans le nouveau modèle. Série et record
 *   inchangés.
 * - Un état sans `daily` est rendu tel quel.
 */
export function migrateQuizStateToSessions(raw: unknown): unknown {
  if (!isRecord(raw) || !('daily' in raw)) return raw;
  const { daily, ...rest } = raw;
  if (!isRecord(daily) || typeof daily['questionId'] !== 'string') return rest;
  const questionId = daily['questionId'];
  const answerIndex = daily['answerIndex'];
  const answered = answerIndex !== undefined;
  const date = typeof daily['date'] === 'string' ? daily['date'].slice(0, 10) : '';
  const seenIds = rest['seenIds'];
  return {
    ...rest,
    ...(answered || !Array.isArray(seenIds)
      ? {}
      : { seenIds: seenIds.filter((id) => id !== questionId) }),
    current: {
      sessionId: `${LEGACY_QUIZ_SESSION_PREFIX}${date}`,
      questionId,
      ...(answered ? { answerIndex } : {}),
    },
  };
}
