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
  PREGNANCY_EXCLUDED_TAGS,
  containsAllergen,
  declaredAllergensIn,
  dislikedIn,
  filterCompatibleRecipes,
  hasTag,
  isBreakfastRecipe,
  isPregnancyRelevant,
  isRecipeCompatible,
  matchesDiets,
  recipeMentions,
  totalMinutes,
} from './compatibility';
export type { DietaryConstraints } from './compatibility';
export {
  ALCOHOL_TERMS,
  AROMATICS,
  ANIMAL_FLESH_TERMS,
  BASIC_INGREDIENTS,
  ANIMAL_RENNET_CHEESES,
  FROZEN_FRUIT_TERMS,
  FROZEN_TERMS,
  PULSE_TERMS,
  STARCHY_PRODUCE,
  VEGAN_EXTRA_TERMS,
  VEGETARIAN_CHEESE_EXCEPTIONS,
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
  checkAllergenDeclarations,
  checkSafetyTags,
} from './audit';
export type { RecipeIssue, RecipeIssueCode, RecipeIssueSeverity } from './audit';
export { CHEESES, FOOD_PREFERENCE_CHIPS, FOOD_SYNONYMS, expandFoodTerm } from './food-terms';
export type { FoodPreferenceChip } from './food-terms';
export { ALLERGEN_KEYWORDS, allergensInIngredient } from './allergen-keywords';
export type { AllergenKeywords } from './allergen-keywords';
