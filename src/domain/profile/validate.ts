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

/** Bornes de plausibilité (incluses) des champs numériques du profil. */
export const PROFILE_BOUNDS: Readonly<
  Record<ProfileField, { readonly min: number; readonly max: number }>
> = {
  age: { min: 10, max: 120 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 25, max: 350 },
  waistCm: { min: 40, max: 200 },
  householdSize: { min: 1, max: 12 },
  weekdayMinutes: { min: 5, max: 240 },
  weekendMinutes: { min: 5, max: 240 },
};

const MESSAGES: Readonly<Record<ProfileField, string>> = {
  age: 'Indique un âge entre 10 et 120 ans.',
  heightCm: 'Indique une taille entre 100 et 250 cm.',
  weightKg: 'Indique un poids entre 25 et 350 kg.',
  waistCm: 'Indique un tour de taille entre 40 et 200 cm.',
  householdSize: 'Le foyer compte de 1 à 12 personnes.',
  weekdayMinutes: 'Indique un temps par repas entre 5 et 240 minutes.',
  weekendMinutes: 'Indique un temps par repas entre 5 et 240 minutes.',
};

/**
 * Contrôles du profil : nombres valides et dans des bornes plausibles (`PROFILE_BOUNDS`).
 * Le tour de taille est facultatif ; le foyer est un nombre entier de personnes.
 */
export function validateProfile(profile: Profile): ProfileIssue[] {
  const values: Record<ProfileField, number | undefined> = {
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    waistCm: profile.waistCm,
    householdSize: profile.householdSize,
    weekdayMinutes: profile.weekdayMinutes,
    weekendMinutes: profile.weekendMinutes,
  };
  const issues: ProfileIssue[] = [];
  for (const field of Object.keys(PROFILE_BOUNDS) as ProfileField[]) {
    const value = values[field];
    if (value === undefined && field === 'waistCm') continue;
    const { min, max } = PROFILE_BOUNDS[field];
    const valid =
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max &&
      (field !== 'householdSize' || Number.isInteger(value));
    if (!valid) issues.push({ field, message: MESSAGES[field] });
  }
  return issues;
}
