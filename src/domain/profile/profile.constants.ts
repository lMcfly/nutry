/** Vocabulaires et seuils du profil. Les valeurs de santé sont regroupées ici pour relecture. */

export const SEXES = ['homme', 'femme', 'autre'] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = ['sedentaire', 'leger', 'modere', 'actif', 'tres-actif'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** Coefficients d'activité appliqués au métabolisme de base. */
export const ACTIVITY_COEFFICIENTS: Readonly<Record<ActivityLevel, number>> = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
  actif: 1.725,
  'tres-actif': 1.9,
};

export const GOALS = ['reequilibrer', 'perdre-en-douceur', 'maintenir', 'energie'] as const;
export type Goal = (typeof GOALS)[number];

/** Texte du bandeau permanent de l'écran Profil. */
export const MEDICAL_DISCLAIMER =
  'Cette app ne remplace pas l’avis d’un médecin ou d’un diététicien.';

export const ADULT_AGE = 18;
export const BMI_LOW_THRESHOLD = 18.5;
export const WAIST_TO_HEIGHT_ALERT_THRESHOLD = 0.5;
/** Déficit maximal appliqué pour « perdre en douceur » (15 % des besoins). */
export const MAX_DEFICIT_RATIO = 0.15;
/** Apport cible minimal en cas de déficit ('autre' : plancher le plus protecteur, 1 500). */
export const ENERGY_FLOOR_KCAL: Readonly<Record<Sex, number>> = {
  homme: 1500,
  femme: 1200,
  autre: 1500,
};

/** Référence des quantités des recettes (une portion « standard » ≈ 2 000 kcal/jour). */
export const REFERENCE_KCAL = 2000;
export const PORTION_FACTOR_MIN = 0.8;
export const PORTION_FACTOR_MAX = 1.3;
