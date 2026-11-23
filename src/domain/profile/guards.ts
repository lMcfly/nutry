import { computeBmi, computeWaistToHeightRatio, isWaistToHeightAlert } from './body';
import { computeBmr, computeEnergyNeeds, computeGentleLossTarget } from './energy';
import { isPregnancyRelevant } from '../recipe';
import {
  ADULT_AGE,
  BMI_LOW_THRESHOLD,
  SENIOR_AGE,
  SENIOR_BMI_LOW_THRESHOLD,
} from './profile.constants';
import type { Profile } from './profile.types';

export type HealthMessageCode =
  | 'mineur'
  | 'grossesse-allaitement'
  | 'condition-sante'
  | 'imc-bas'
  | 'imc-bas-senior'
  | 'tour-de-taille';

/** Message bienveillant à afficher dans le profil (jamais culpabilisant). */
export interface HealthMessage {
  readonly code: HealthMessageCode;
  readonly text: string;
  /** Vrai si le message invite à consulter un professionnel de santé. */
  readonly suggestProfessional: boolean;
}

export const HEALTH_MESSAGES: Readonly<Record<HealthMessageCode, HealthMessage>> = {
  mineur: {
    code: 'mineur',
    text: 'Avant 18 ans, le corps est encore en pleine croissance : ici, pas de restriction. Pour toute question sur ton alimentation, consulte un professionnel de santé (médecin, diététicien).',
    suggestProfessional: true,
  },
  'grossesse-allaitement': {
    code: 'grossesse-allaitement',
    text: 'Pendant la grossesse ou l’allaitement, tes besoins sont particuliers : ici, pas de restriction. Consulte un professionnel de santé (médecin, sage-femme, diététicien) pour un accompagnement adapté.',
    suggestProfessional: true,
  },
  'condition-sante': {
    code: 'condition-sante',
    text: 'Avec une condition de santé particulière, ton alimentation mérite un accompagnement sur mesure : ici, pas de restriction. Parles-en à ton médecin ou à un diététicien, ils sauront te conseiller.',
    suggestProfessional: true,
  },
  'imc-bas-senior': {
    code: 'imc-bas-senior',
    text: 'Avec les années, bien manger aide à garder force et énergie : ici, pas de restriction, on mise sur des assiettes généreuses et variées. Parles-en à ton médecin lors de ta prochaine visite, il saura t’accompagner.',
    suggestProfessional: true,
  },
  'imc-bas': {
    code: 'imc-bas',
    text: 'Ton profil ne demande pas de perte de poids : on t’aide plutôt à manger varié et à garder de l’énergie. Si tu as des questions, un professionnel de santé saura t’écouter.',
    suggestProfessional: true,
  },
  'tour-de-taille': {
    code: 'tour-de-taille',
    text: 'Ton tour de taille peut faire l’objet d’un petit échange avec ton médecin, qui saura t’éclairer. Rien ne change ici : on continue ensemble, à ton rythme.',
    suggestProfessional: true,
  },
};

/** Bilan énergétique d'un profil, garde-fous appliqués. Les kcal restent internes. */
export interface EnergyAssessment {
  readonly bmi: number;
  /** Absent si le tour de taille n'est pas renseigné. */
  readonly waistToHeightRatio?: number;
  readonly bmrKcal: number;
  readonly needsKcal: number;
  /** Cible journalière (= besoins hors perte autorisée). */
  readonly targetKcal: number;
  /** Vrai si un déficit est effectivement appliqué. */
  readonly deficitApplied: boolean;
  /** Faux si l'objectif « perdre en douceur » doit être grisé dans l'UI. */
  readonly perteAutorisee: boolean;
  /**
   * Profil protégé (mineur, grossesse/allaitement, condition de santé, IMC bas) :
   * portions jamais réduites, avis « trop copieux » ignorés.
   */
  readonly protectedProfile: boolean;
  /**
   * Suivi du poids activé par défaut : faux pour tout profil protégé (`protectedProfile`),
   * vrai sinon. Un choix explicite de la personne prime toujours (ADR 0007).
   */
  readonly weightTrackingEnabledByDefault: boolean;
  readonly messages: readonly HealthMessage[];
}

/** Seuil d'IMC bas selon l'âge : 22 à partir de 70 ans, 18,5 sinon. */
export function lowBmiThreshold(age: number): number {
  return age >= SENIOR_AGE ? SENIOR_BMI_LOW_THRESHOLD : BMI_LOW_THRESHOLD;
}

/**
 * Suivi du poids proposé par défaut ? Non pour tout profil protégé : moins de 18 ans,
 * grossesse ou allaitement, condition de santé, IMC bas (18,5, ou 22 dès 70 ans). La
 * personne peut toujours l'activer elle-même (choix explicite enregistré).
 */
export function isWeightTrackingEnabledByDefault(profile: Profile): boolean {
  return assessEnergy(profile).weightTrackingEnabledByDefault;
}

/**
 * Applique les garde-fous de santé et calcule la cible énergétique :
 * - moins de 18 ans, grossesse ou allaitement, condition de santé → aucun déficit,
 *   invitation à consulter ;
 * - IMC < 18,5 (< 22 à partir de 70 ans) → perte désactivée, message bienveillant ;
 * - rapport tour de taille / taille ≥ 0,5 → message bienveillant, objectif inchangé ;
 * - sinon « perdre en douceur » → déficit plafonné à 15 % et plancher 1 500 / 1 200 kcal.
 * Les messages sont renvoyés quel que soit l'objectif choisi.
 */
export function assessEnergy(profile: Profile): EnergyAssessment {
  const bmi = computeBmi(profile.weightKg, profile.heightCm);
  const bmrKcal = computeBmr(profile);
  const needsKcal = computeEnergyNeeds(bmrKcal, profile.activity);
  const messages: HealthMessage[] = [];

  if (profile.age < ADULT_AGE) messages.push(HEALTH_MESSAGES.mineur);
  if (isPregnancyRelevant(profile)) messages.push(HEALTH_MESSAGES['grossesse-allaitement']);
  if (profile.healthCondition === true) messages.push(HEALTH_MESSAGES['condition-sante']);
  if (bmi < lowBmiThreshold(profile.age)) {
    messages.push(HEALTH_MESSAGES[profile.age >= SENIOR_AGE ? 'imc-bas-senior' : 'imc-bas']);
  }

  let waistToHeightRatio: number | undefined;
  if (profile.waistCm !== undefined) {
    waistToHeightRatio = computeWaistToHeightRatio(profile.waistCm, profile.heightCm);
    if (isWaistToHeightAlert(waistToHeightRatio)) messages.push(HEALTH_MESSAGES['tour-de-taille']);
  }

  const perteAutorisee = !messages.some((m) => m.code !== 'tour-de-taille');
  const wantsLoss = profile.goal === 'perdre-en-douceur' && perteAutorisee;
  const targetKcal = wantsLoss ? computeGentleLossTarget(needsKcal, profile.sex) : needsKcal;

  return {
    bmi,
    ...(waistToHeightRatio === undefined ? {} : { waistToHeightRatio }),
    bmrKcal,
    needsKcal,
    targetKcal,
    deficitApplied: targetKcal < needsKcal,
    perteAutorisee,
    protectedProfile: !perteAutorisee,
    // Aligné sur `protectedProfile` : pas d'accent mis sur le poids pour ces profils.
    weightTrackingEnabledByDefault: perteAutorisee,
    messages,
  };
}

/**
 * Objectif effectivement retenu : « perdre en douceur » redevient « rééquilibrer » quand
 * les garde-fous l'interdisent (`perteAutorisee` faux). Appliqué à l'enregistrement et à
 * l'import : aucun profil protégé ne garde un objectif de perte.
 */
export function normalizeGoal(
  profile: Profile,
  assessment: Pick<EnergyAssessment, 'perteAutorisee'> = assessEnergy(profile),
): Profile {
  return !assessment.perteAutorisee && profile.goal === 'perdre-en-douceur'
    ? { ...profile, goal: 'reequilibrer' }
    : profile;
}
