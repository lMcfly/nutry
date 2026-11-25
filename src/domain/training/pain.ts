import { addDays, daysBetween, type IsoDate } from '../shared';
import { TRAINING_SAFETY_MESSAGES } from './safety.constants';
import { MUSCLE_GROUPS, PAIN_RULES } from './training.constants';
import type { PainReport, TrainingSafetyMessage } from './training.types';

/**
 * Exercices signalés (« Ça fait mal ») depuis moins de `PAIN_RULES.avoidDays` jours : écartés
 * le jour du signalement et les 27 suivants, de nouveau permis le 28e jour. Un signalement daté
 * d'après `today` (horloge décalée) reste écarté par prudence. Liste triée, sans doublon.
 */
export function avoidedExerciseIds(reports: readonly PainReport[], today: IsoDate): string[] {
  const ids = reports
    .filter((report) => daysBetween(report.date, today) < PAIN_RULES.avoidDays)
    .map((report) => report.exerciseId);
  return [...new Set(ids)].sort();
}

/** Premier jour où l'exercice signalé le `date` est de nouveau proposé. */
export function painAvoidanceEnd(date: IsoDate): IsoDate {
  return addDays(date, PAIN_RULES.avoidDays);
}

/**
 * Messages affichés après un signalement : toujours `douleur` et `urgence` ; `douleur-repetee`
 * quand `repeatedThreshold` signalements des `windowDays` derniers jours partagent un groupe
 * musculaire.
 */
export function painMessages(
  reports: readonly PainReport[],
  today: IsoDate,
): TrainingSafetyMessage[] {
  const recent = reports.filter((report) => {
    const gap = daysBetween(report.date, today);
    return gap < PAIN_RULES.windowDays;
  });
  const repeated = MUSCLE_GROUPS.some(
    (group) =>
      recent.filter((report) => report.muscles.includes(group)).length >=
      PAIN_RULES.repeatedThreshold,
  );
  const messages = [TRAINING_SAFETY_MESSAGES.douleur];
  if (repeated) messages.push(TRAINING_SAFETY_MESSAGES['douleur-repetee']);
  messages.push(TRAINING_SAFETY_MESSAGES.urgence);
  return messages;
}
