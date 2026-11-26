import type { ActivityLevel, Profile } from '../profile';
import type { IsoDate } from '../shared';
import type { Equipment, MovementPattern, SlotRole, TrainingLevel } from './training.constants';
import type {
  Exercise,
  ExerciseLog,
  PainReport,
  SessionLog,
  TrainingProfile,
  TrainingSafety,
} from './training.types';

/**
 * Types d'entrée des fonctions pures du module Sport (ADR 0015). Les fonctions de la phase 1
 * sont implémentées sous leur nom en camelCase, dans le fichier qui porte leur sujet :
 * `safety.ts`, `select.ts`, `cycle.ts`, `progression.ts`, `duration.ts`, `plan.ts`, `pain.ts`,
 * `fingerprint.ts`, `session.ts`, `meals.ts`, `volume.ts`. Aucune ne lit l'heure ni l'aléa.
 */

/** Contexte de sélection d'un exercice pour un créneau. */
export interface EligibilityContext {
  readonly pattern: MovementPattern;
  readonly role: SlotRole;
  readonly level: TrainingLevel;
  /** Matériel disponible, `ALWAYS_AVAILABLE_EQUIPMENT` compris. */
  readonly equipment: readonly Equipment[];
  readonly safety: TrainingSafety;
  /** Exercices écartés après une douleur (`avoidedExerciseIds`). */
  readonly avoidedExerciseIds: readonly string[];
}

/** Historique d'un exercice : ses journaux, du plus ancien au plus récent. */
export interface ExerciseHistoryEntry {
  readonly date: IsoDate;
  readonly log: ExerciseLog;
}

/** Entrée du planificateur. */
export interface PlanTrainingWeekInput {
  readonly weekStart: IsoDate;
  readonly profile: Profile;
  readonly training: TrainingProfile;
  readonly catalog: readonly Exercise[];
  /** Journaux passés (toutes semaines) : cycle et progression. */
  readonly logs: readonly SessionLog[];
  readonly painReports: readonly PainReport[];
  /** Jour local, pour la fenêtre des douleurs. */
  readonly today: IsoDate;
}

/**
 * Suggestion (jamais automatique, `suggestActivityLevel` dans `meals.ts`) : le niveau juste
 * au-dessus du niveau déclaré quand le volume prévu atteint le plancher
 * `ACTIVITY_FLOOR_BY_WEEKLY_MINUTES` d'un niveau plus haut ; `undefined` si rien à proposer.
 */
export type SuggestActivityLevel = (
  declared: ActivityLevel,
  training: TrainingProfile,
) => ActivityLevel | undefined;
