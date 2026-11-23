import { computeBmi, computeWaistToHeightRatio, isWaistToHeightAlert } from './body';
import { computeBmr, computeEnergyNeeds, computeGentleLossTarget } from './energy';
import { ADULT_AGE, BMI_LOW_THRESHOLD } from './profile.constants';
import type { Profile } from './profile.types';

export type HealthMessageCode = 'mineur' | 'grossesse-allaitement' | 'imc-bas' | 'tour-de-taille';

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
  readonly messages: readonly HealthMessage[];
}

/** Grossesse / allaitement n'est pris en compte que pour 'femme' et 'autre'. */
export function isPregnancyRelevant(
  profile: Pick<Profile, 'sex' | 'pregnantOrBreastfeeding'>,
): boolean {
  return profile.sex !== 'homme' && profile.pregnantOrBreastfeeding;
}

/**
 * Applique les garde-fous de santé et calcule la cible énergétique :
 * - moins de 18 ans, grossesse ou allaitement → aucun déficit, invitation à consulter ;
 * - IMC < 18,5 → perte désactivée, message bienveillant ;
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
  if (bmi < BMI_LOW_THRESHOLD) messages.push(HEALTH_MESSAGES['imc-bas']);

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
    messages,
  };
}
