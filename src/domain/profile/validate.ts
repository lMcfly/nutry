import type { Profile } from './profile.types';

export type ProfileField =
  | 'age'
  | 'heightCm'
  | 'weightKg'
  | 'waistCm'
  | 'householdSize'
  | 'weekdayMinutes'
  | 'weekendMinutes';

export interface ProfileIssue {
  readonly field: ProfileField;
  readonly message: string;
}

/**
 * Contrôles structurels du profil (nombres valides). Aucune borne médicale :
 * les plages plausibles d'âge, de taille ou de poids restent à faire valider.
 */
export function validateProfile(profile: Profile): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  const positive: [ProfileField, number | undefined][] = [
    ['age', profile.age],
    ['heightCm', profile.heightCm],
    ['weightKg', profile.weightKg],
    ['waistCm', profile.waistCm],
  ];
  for (const [field, value] of positive) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
      issues.push({ field, message: 'Indique un nombre supérieur à zéro.' });
    }
  }
  if (!Number.isInteger(profile.householdSize) || profile.householdSize < 1) {
    issues.push({ field: 'householdSize', message: 'Le foyer compte au moins une personne.' });
  }
  for (const field of ['weekdayMinutes', 'weekendMinutes'] as const) {
    if (!Number.isFinite(profile[field]) || profile[field] < 0) {
      issues.push({ field, message: 'Indique un temps en minutes (0 ou plus).' });
    }
  }
  return issues;
}
