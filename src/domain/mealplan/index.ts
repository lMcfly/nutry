export { DAY_INDEXES, MEAL_SLOTS } from './mealplan.types';
export type {
  DayIndex,
  MealSlot,
  PlanNotice,
  PlanNoticeCode,
  PlannedMeal,
  RelaxedConstraint,
  ScoreBreakdown,
  ScoreComponent,
  ScoreComponentKey,
  ScoreFacts,
  WeeklyPlan,
} from './mealplan.types';
export { DAY_NAMES, SLOT_NAMES, mealLabel } from './labels';
export { dayRequirements } from './schedule';
export type { DayRequirements } from './schedule';
export {
  SCORE_RULES,
  TRAINING_DAY_MIN_STARCH_SHARE,
  isConsecutiveProtein,
  rankRecipes,
  scoreRecipe,
} from './scoring';
export type { RankedRecipe, ScoringContext } from './scoring';
export { MAX_LEFTOVERS_PER_WEEK, PLAN_NOTICES, generateWeeklyPlan, mealId } from './generate';
export type { GeneratePlanInput } from './generate';
export { applyReplacement, replaceMeal } from './replace';
export type { ReplaceMealInput } from './replace';
export { explainMeal, joinFr } from './explain';
export {
  BATCH_PREP_KINDS,
  BATCH_PREP_TEXTS,
  COOK_AHEAD_TERMS,
  FIRM_VEGETABLE_TERMS,
  buildBatchCookingPlan,
  sauceToPrepare,
} from './batch';
export type { BatchPrepGroup, BatchPrepKind, BatchPrepTask } from './batch';
export { BALANCE_TARGETS, computeWeekBalance } from './balance';
export type { BalanceGauge, BalanceGaugeKey } from './balance';
