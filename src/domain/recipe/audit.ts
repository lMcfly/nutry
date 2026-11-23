import { containsAnyTerm } from '../shared';
import { isBreakfastRecipe, totalMinutes } from './compatibility';
import { ANIMAL_FLESH_TERMS, VEGAN_EXTRA_TERMS, isBasicIngredient } from './ingredients';
import type { Allergen, ProteinType } from './recipe.constants';
import type { Recipe } from './recipe.types';

/**
 * Contrôles de cohérence d'une recette, utilisés par les tests de contenu et la
 * validation Zod. Les règles de régime sont conservatrices : en cas de doute, erreur.
 */
export type RecipeIssueSeverity = 'erreur' | 'avertissement';

export type RecipeIssueCode =
  | 'regime-allergene'
  | 'regime-proteine'
  | 'regime-ingredient'
  | 'regime-incomplet'
  | 'assiette-somme'
  | 'assiette-peu-de-legumes'
  | 'nutrition-incoherente'
  | 'nutrition-hors-plage'
  | 'proteines-faibles'
  | 'niveau-temps'
  | 'niveau-ingredients';

export interface RecipeIssue {
  readonly code: RecipeIssueCode;
  readonly severity: RecipeIssueSeverity;
  readonly message: string;
}

const MEAT_AND_SEAFOOD: readonly ProteinType[] = [
  'boeuf',
  'porc',
  'volaille',
  'agneau',
  'poisson',
  'fruits-de-mer',
];
const VEGAN_PROTEINS: readonly ProteinType[] = ['legumineuses', 'soja-tofu', 'aucune'];
const SEAFOOD_ALLERGENS: readonly Allergen[] = ['poissons', 'crustaces', 'mollusques'];
const VEGAN_FORBIDDEN_ALLERGENS: readonly Allergen[] = [...SEAFOOD_ALLERGENS, 'lait', 'oeufs'];

/** Seuils de vraisemblance (à faire valider par un·e diététicien·ne). */
export const RECIPE_AUDIT_LIMITS = {
  /** Écart toléré entre kcal déclarées et kcal recalculées (4/4/9/2 kcal par g). */
  atwaterTolerance: 0.2,
  mainKcal: { min: 250, max: 1000 },
  breakfastKcal: { min: 150, max: 700 },
  mainMinProteinG: 12,
  mainMinVegetables: 0.3,
  simpleMaxMinutes: 20,
  simpleMaxIngredients: 6,
  mediumMaxMinutes: 45,
} as const;

const error = (code: RecipeIssueCode, message: string): RecipeIssue => ({
  code,
  severity: 'erreur',
  message,
});
const warning = (code: RecipeIssueCode, message: string): RecipeIssue => ({
  code,
  severity: 'avertissement',
  message,
});

/**
 * Cohérence régime ↔ allergènes / protéine / ingrédients (erreurs bloquantes) :
 * - végan : ni lait, œufs, poissons, crustacés, mollusques ; protéine végétale ou aucune ;
 *   ni chair animale ni miel ;
 * - végétarien : ni poissons, crustacés, mollusques ; pas de viande ni poisson en protéine ;
 *   aucune chair animale ni gélatine dans les ingrédients ;
 * - sans lactose : aucun allergène `lait` (strict, fromages affinés compris) ;
 * - sans gluten : aucun allergène `gluten`.
 */
export function checkDietConsistency(recipe: Recipe): RecipeIssue[] {
  const issues: RecipeIssue[] = [];
  const has = (diet: Recipe['diets'][number]) => recipe.diets.includes(diet);
  const forbidAllergens = (diet: string, forbidden: readonly Allergen[]) => {
    for (const allergen of recipe.allergens.filter((a) => forbidden.includes(a))) {
      issues.push(
        error('regime-allergene', `${diet} incompatible avec l’allergène « ${allergen} »`),
      );
    }
  };
  const forbidTerms = (diet: string, terms: readonly string[]) => {
    for (const ingredient of recipe.ingredients.filter((i) => containsAnyTerm(i.name, terms))) {
      issues.push(
        error('regime-ingredient', `${diet} incompatible avec l’ingrédient « ${ingredient.name} »`),
      );
    }
  };

  if (has('vegan')) {
    forbidAllergens('vegan', VEGAN_FORBIDDEN_ALLERGENS);
    if (!VEGAN_PROTEINS.includes(recipe.mainProtein)) {
      issues.push(
        error('regime-proteine', `vegan incompatible avec la protéine « ${recipe.mainProtein} »`),
      );
    }
    forbidTerms('vegan', [...ANIMAL_FLESH_TERMS, ...VEGAN_EXTRA_TERMS]);
  } else if (has('vegetarien')) {
    forbidAllergens('vegetarien', SEAFOOD_ALLERGENS);
    if (MEAT_AND_SEAFOOD.includes(recipe.mainProtein)) {
      issues.push(
        error(
          'regime-proteine',
          `vegetarien incompatible avec la protéine « ${recipe.mainProtein} »`,
        ),
      );
    }
    forbidTerms('vegetarien', ANIMAL_FLESH_TERMS);
  }
  if (has('sans-lactose')) forbidAllergens('sans-lactose', ['lait']);
  if (has('sans-gluten')) forbidAllergens('sans-gluten', ['gluten']);
  return issues;
}

/**
 * Complétude des régimes (avertissements) : une recette oubliant un régime plus large
 * devient invisible pour ces profils (`omnivore` toujours, végan ⇒ végétarien ⇒ flexitarien).
 */
export function checkDietCompleteness(recipe: Recipe): RecipeIssue[] {
  const implied: [Recipe['diets'][number], Recipe['diets'][number]][] = [
    ['vegan', 'vegetarien'],
    ['vegetarien', 'flexitarien'],
  ];
  const missing = new Set<string>();
  if (!recipe.diets.includes('omnivore')) missing.add('omnivore');
  for (const [diet, impliedDiet] of implied) {
    if (recipe.diets.includes(diet) && !recipe.diets.includes(impliedDiet))
      missing.add(impliedDiet);
  }
  return [...missing].map((diet) =>
    warning('regime-incomplet', `le régime « ${diet} » devrait figurer dans la liste`),
  );
}

/** Proportions de l'assiette et vraisemblance des valeurs nutritionnelles. */
export function checkNutrition(recipe: Recipe): RecipeIssue[] {
  const issues: RecipeIssue[] = [];
  const { vegetables, proteins, starches } = recipe.plateBalance;
  const breakfast = isBreakfastRecipe(recipe);
  const limits = RECIPE_AUDIT_LIMITS;

  if (Math.abs(vegetables + proteins + starches - 1) > 0.01) {
    issues.push(error('assiette-somme', 'la somme des proportions de l’assiette doit valoir 1'));
  }
  if (!breakfast && vegetables < limits.mainMinVegetables) {
    issues.push(warning('assiette-peu-de-legumes', 'moins de 30 % de légumes dans l’assiette'));
  }

  const n = recipe.nutritionPerServing;
  const computed = 4 * n.proteinG + 4 * n.carbsG + 9 * n.fatG + 2 * n.fiberG;
  if (computed === 0 || Math.abs(n.kcal - computed) / computed > limits.atwaterTolerance) {
    issues.push(
      warning(
        'nutrition-incoherente',
        `kcal déclarées (${n.kcal}) éloignées des macros (${Math.round(computed)})`,
      ),
    );
  }
  const range = breakfast ? limits.breakfastKcal : limits.mainKcal;
  if (n.kcal < range.min || n.kcal > range.max) {
    issues.push(
      warning(
        'nutrition-hors-plage',
        `${n.kcal} kcal par portion, hors de [${range.min} ; ${range.max}]`,
      ),
    );
  }
  if (!breakfast && n.proteinG < limits.mainMinProteinG) {
    issues.push(warning('proteines-faibles', `${n.proteinG} g de protéines par portion`));
  }
  return issues;
}

/** Cohérence du niveau : simple ≤ 20 min et ≤ 6 ingrédients (hors basiques), médium ≤ 45 min. */
export function checkLevel(recipe: Recipe): RecipeIssue[] {
  const issues: RecipeIssue[] = [];
  const minutes = totalMinutes(recipe);
  const limits = RECIPE_AUDIT_LIMITS;
  if (recipe.level === 'simple') {
    if (minutes > limits.simpleMaxMinutes) {
      issues.push(warning('niveau-temps', `${minutes} min pour une recette simple`));
    }
    const count = recipe.ingredients.filter((i) => !isBasicIngredient(i.name)).length;
    if (count > limits.simpleMaxIngredients) {
      issues.push(warning('niveau-ingredients', `${count} ingrédients pour une recette simple`));
    }
  }
  if (recipe.level === 'medium' && minutes > limits.mediumMaxMinutes) {
    issues.push(warning('niveau-temps', `${minutes} min pour une recette médium`));
  }
  return issues;
}

/** Tous les contrôles d'une recette. */
export function auditRecipe(recipe: Recipe): RecipeIssue[] {
  return [
    ...checkDietConsistency(recipe),
    ...checkDietCompleteness(recipe),
    ...checkNutrition(recipe),
    ...checkLevel(recipe),
  ];
}
