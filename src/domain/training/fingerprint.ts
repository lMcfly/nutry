import type { Profile } from '../profile';
import { TRAINING_SENIOR_AGE } from './training.constants';
import type { TrainingProfile } from './training.types';

/**
 * Empreinte des contraintes qui imposent de régénérer le programme enregistré : jours, cadre,
 * matériel (trié), niveau, objectif, durée, étape de grossesse (seulement si grossesse ou
 * allaitement), et les champs du profil lus par la sécurité (70 ans et plus, moins de 18 ans,
 * grossesse, condition de santé). L'âge lui-même n'y figure pas, seulement ses deux seuils :
 * un anniversaire ordinaire ne régénère pas le programme.
 */
export function trainingConstraintsKey(profile: Profile, training: TrainingProfile): string {
  const pregnant = profile.pregnantOrBreastfeeding && profile.sex !== 'homme';
  return [
    `d=${[...training.days].sort((a, b) => a - b).join(',')}`,
    `s=${training.setting}`,
    `e=${[...training.equipment].sort().join(',')}`,
    `l=${training.level}`,
    `g=${training.goal}`,
    `m=${training.sessionMinutes}`,
    `p=${pregnant ? (training.pregnancyStage ?? 'inconnue') : '-'}`,
    `sn=${profile.age >= TRAINING_SENIOR_AGE ? 1 : 0}`,
    `mn=${profile.age < 18 ? 1 : 0}`,
    `hc=${profile.healthCondition === true ? 1 : 0}`,
  ].join('|');
}
