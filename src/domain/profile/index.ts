export {
  ACTIVITY_COEFFICIENTS,
  ACTIVITY_LEVELS,
  ADULT_AGE,
  BMI_LOW_THRESHOLD,
  ENERGY_FLOOR_KCAL,
  GOALS,
  MAX_DEFICIT_RATIO,
  MEDICAL_DISCLAIMER,
  PORTION_FACTOR_MAX,
  PORTION_FACTOR_MIN,
  REFERENCE_KCAL,
  SEXES,
  WAIST_TO_HEIGHT_ALERT_THRESHOLD,
} from './profile.constants';
export type { ActivityLevel, Goal, Sex } from './profile.constants';
export type { Profile } from './profile.types';
export { computeBmi, computeWaistToHeightRatio, isWaistToHeightAlert } from './body';
export { computeBmr, computeEnergyNeeds, computeGentleLossTarget } from './energy';
export type { BmrInput } from './energy';
export { HEALTH_MESSAGES, assessEnergy, isPregnancyRelevant } from './guards';
export type { EnergyAssessment, HealthMessage, HealthMessageCode } from './guards';
export { computePortionFactor, factorForCategory, scaleRecipeForHousehold } from './portions';
export type { HouseholdPortions } from './portions';
export { validateProfile } from './validate';
export type { ProfileField, ProfileIssue } from './validate';
