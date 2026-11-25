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
  SENIOR_AGE,
  SENIOR_BMI_LOW_THRESHOLD,
  SEXES,
  WAIST_TO_HEIGHT_ALERT_THRESHOLD,
} from './profile.constants';
export type { ActivityLevel, Goal, Sex } from './profile.constants';
export type { Profile } from './profile.types';
export { computeBmi, computeWaistToHeightRatio, isWaistToHeightAlert } from './body';
export { computeBmr, computeEnergyNeeds, computeGentleLossTarget } from './energy';
export type { BmrInput } from './energy';
export {
  HEALTH_MESSAGES,
  assessEnergy,
  isWeightTrackingEnabledByDefault,
  lowBmiThreshold,
  normalizeGoal,
} from './guards';
export { isPregnancyRelevant } from '../recipe';
export type { EnergyAssessment, HealthMessage, HealthMessageCode } from './guards';
export {
  computePortionFactor,
  computeUserPortionFactor,
  factorForCategory,
  scaleRecipeForHousehold,
} from './portions';
export type { HouseholdPortions } from './portions';
export { PROFILE_BOUNDS, validateProfile } from './validate';
export type { ProfileField, ProfileIssue } from './validate';
export {
  PROFILE_QUESTIONS,
  PROFILE_QUESTION_IDS,
  FIRST_ONBOARDING_SCREEN,
  ONBOARDING_SCREENS,
  PROFILE_STEPS,
  asksPregnancy,
  onboardingQuestions,
  onboardingScreens,
  stepOfQuestion,
} from './questions';
export type {
  OnboardingScreen,
  OnboardingScreenId,
  ProfileQuestionId,
  ProfileQuestionText,
  ProfileStep,
  ProfileStepId,
} from './questions';
