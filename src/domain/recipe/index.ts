export {
  AISLES,
  ALLERGENS,
  DIETS,
  LEVELS,
  PROTEIN_TYPES,
  RECIPE_TAGS,
  UNITS,
} from './recipe.constants';
export type {
  Aisle,
  Allergen,
  Diet,
  Level,
  ProteinType,
  RecipeTag,
  Unit,
} from './recipe.constants';
export type { NutritionPerServing, PlateBalance, Recipe, RecipeIngredient } from './recipe.types';
export {
  containsAllergen,
  declaredAllergensIn,
  dislikedIn,
  filterCompatibleRecipes,
  hasTag,
  isBreakfastRecipe,
  isRecipeCompatible,
  matchesDiets,
  recipeMentions,
  totalMinutes,
} from './compatibility';
export type { DietaryConstraints } from './compatibility';
export {
  AROMATICS,
  ANIMAL_FLESH_TERMS,
  BASIC_INGREDIENTS,
  PULSE_TERMS,
  STARCHY_PRODUCE,
  VEGAN_EXTRA_TERMS,
  WHOLE_GRAIN_TERMS,
  categorizeIngredient,
  isBasicIngredient,
} from './ingredients';
export type { IngredientCategory } from './ingredients';
export {
  RECIPE_AUDIT_LIMITS,
  auditRecipe,
  checkDietCompleteness,
  checkDietConsistency,
  checkLevel,
  checkNutrition,
} from './audit';
export type { RecipeIssue, RecipeIssueCode, RecipeIssueSeverity } from './audit';
