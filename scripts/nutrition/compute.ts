/**
 * Pipeline nutritionnel : calcule `nutritionPerServing` de chaque recette à partir de la
 * table Ciqual 2025 (ANSES) et de la correspondance ingrédient → aliment Ciqual.
 * Conventions : data/ciqual/README.md.
 *
 *   npm run nutrition:write   recalcule et réécrit src/infrastructure/data/recipes.json
 *   npm run nutrition:check   signale les écarts sans rien écrire (code de sortie 1 si écart)
 *
 * Les fonctions sont pures ; seule la partie CLI (en bas) lit et écrit des fichiers.
 * `data/` reste hors de `src/` : la table Ciqual n'entre jamais dans le bundle.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { NutritionPerServing, Recipe, RecipeIngredient, Unit } from '../../src/domain/recipe';

// ------------------------------------------------------------------ Schémas des fichiers

const ciqualFoodSchema = z.object({
  code: z.string().min(1),
  nom: z.string().min(1),
  groupe: z.string(),
  kcal: z.number().nonnegative(),
  proteinesG: z.number().nonnegative(),
  glucidesG: z.number().nonnegative(),
  lipidesG: z.number().nonnegative(),
  fibresG: z.number().nonnegative(),
});
export type CiqualFood = z.infer<typeof ciqualFoodSchema>;

export const ciqualTableSchema = z.object({
  source: z.string(),
  via: z.string(),
  aliments: z.array(ciqualFoodSchema),
});

/** Unités converties sans facteur : la masse est lue directement. */
export const MASS_UNITS: Readonly<Partial<Record<Unit, number>>> = { g: 1, kg: 1000 };

const mappingEntrySchema = z
  .object({
    ciqualCode: z.string().min(1),
    /** Grammes de partie comestible par unité non massique (pièce, cuillère, cl, boîte…). */
    gramsPerUnit: z.record(z.string(), z.number().positive()).optional(),
    /** Part comestible quand la quantité est pesée brute (moules en coquille, courge entière). */
    ediblePortion: z.number().positive().max(1).optional(),
    /** Correspondance approchée : raison et aliment retenu (affichée dans les rapports). */
    approx: z.string().min(1).optional(),
  })
  .strict();
export type IngredientMapping = z.infer<typeof mappingEntrySchema>;

export const ingredientMappingFileSchema = z.record(z.string(), mappingEntrySchema);
export type IngredientMappingFile = z.infer<typeof ingredientMappingFileSchema>;

// ------------------------------------------------------------------ Calcul

export type NutritionIssue =
  | {
      readonly kind: 'ingredient-non-mappe';
      readonly recipeId: string;
      readonly ingredient: string;
    }
  | { readonly kind: 'code-ciqual-inconnu'; readonly ingredient: string; readonly code: string }
  | { readonly kind: 'fiche-ciqual-incomplete'; readonly ingredient: string; readonly code: string }
  | {
      readonly kind: 'unite-sans-conversion';
      readonly recipeId: string;
      readonly ingredient: string;
      readonly unit: Unit;
    };

/** Aliments dont l'énergie nulle est réelle (et non une valeur manquante). */
const ZERO_ENERGY_FOODS = new Set(['18066']);

/**
 * Fiche Ciqual inexploitable : énergie à 0 alors que des macronutriments sont renseignés
 * (la conversion source remplace les valeurs manquantes par 0).
 */
export function isIncompleteFood(food: CiqualFood): boolean {
  if (ZERO_ENERGY_FOODS.has(food.code)) return false;
  const macros = food.proteinesG + food.glucidesG + food.lipidesG + food.fibresG;
  return food.kcal === 0 && macros > 0;
}

export function indexCiqual(foods: readonly CiqualFood[]): ReadonlyMap<string, CiqualFood> {
  return new Map(foods.map((food) => [food.code, food]));
}

/** Masse comestible (g) d'un ingrédient, ou `undefined` si l'unité n'a pas de conversion. */
export function ingredientGrams(
  ingredient: RecipeIngredient,
  mapping: IngredientMapping,
): number | undefined {
  const factor = MASS_UNITS[ingredient.unit] ?? mapping.gramsPerUnit?.[ingredient.unit];
  if (factor === undefined) return undefined;
  return ingredient.quantity * factor * (mapping.ediblePortion ?? 1);
}

/** Problèmes bloquants : ingrédient non mappé, code inconnu ou incomplet, unité sans conversion. */
export function findNutritionIssues(
  recipes: readonly Recipe[],
  mappings: IngredientMappingFile,
  foods: ReadonlyMap<string, CiqualFood>,
): NutritionIssue[] {
  const issues: NutritionIssue[] = [];
  for (const [ingredient, mapping] of Object.entries(mappings)) {
    const food = foods.get(mapping.ciqualCode);
    if (!food) issues.push({ kind: 'code-ciqual-inconnu', ingredient, code: mapping.ciqualCode });
    else if (isIncompleteFood(food)) {
      issues.push({ kind: 'fiche-ciqual-incomplete', ingredient, code: mapping.ciqualCode });
    }
  }
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const mapping = mappings[ingredient.name];
      if (!mapping) {
        issues.push({
          kind: 'ingredient-non-mappe',
          recipeId: recipe.id,
          ingredient: ingredient.name,
        });
      } else if (ingredientGrams(ingredient, mapping) === undefined) {
        issues.push({
          kind: 'unite-sans-conversion',
          recipeId: recipe.id,
          ingredient: ingredient.name,
          unit: ingredient.unit,
        });
      }
    }
  }
  return issues;
}

export function describeIssue(issue: NutritionIssue): string {
  switch (issue.kind) {
    case 'ingredient-non-mappe':
      return `${issue.recipeId} : « ${issue.ingredient} » absent de data/ciqual/ingredients.json`;
    case 'code-ciqual-inconnu':
      return `« ${issue.ingredient} » : code Ciqual ${issue.code} introuvable dans la table`;
    case 'fiche-ciqual-incomplete':
      return `« ${issue.ingredient} » : fiche Ciqual ${issue.code} incomplète (énergie manquante)`;
    case 'unite-sans-conversion':
      return `${issue.recipeId} : « ${issue.ingredient} » en « ${issue.unit} » sans gramsPerUnit`;
  }
}

/** kcal à l'unité, grammes à 0,1 g (sans bruit de virgule flottante). */
export const roundKcal = (value: number): number => Math.round(value);
export const roundGrams = (value: number): number => Math.round(value * 10) / 10;

/**
 * Valeurs nutritionnelles par portion d'une recette. Lève une erreur si une donnée manque :
 * appelle `findNutritionIssues` d'abord pour un rapport complet.
 */
export function computeNutritionPerServing(
  recipe: Recipe,
  mappings: IngredientMappingFile,
  foods: ReadonlyMap<string, CiqualFood>,
): NutritionPerServing {
  const total = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
  for (const ingredient of recipe.ingredients) {
    const mapping = mappings[ingredient.name];
    const food = mapping ? foods.get(mapping.ciqualCode) : undefined;
    const grams = mapping ? ingredientGrams(ingredient, mapping) : undefined;
    if (!food || grams === undefined) {
      throw new Error(`${recipe.id} : données manquantes pour « ${ingredient.name} »`);
    }
    const ratio = grams / 100;
    total.kcal += food.kcal * ratio;
    total.proteinG += food.proteinesG * ratio;
    total.carbsG += food.glucidesG * ratio;
    total.fatG += food.lipidesG * ratio;
    total.fiberG += food.fibresG * ratio;
  }
  const per = (value: number) => value / recipe.servings;
  return {
    kcal: roundKcal(per(total.kcal)),
    proteinG: roundGrams(per(total.proteinG)),
    carbsG: roundGrams(per(total.carbsG)),
    fatG: roundGrams(per(total.fatG)),
    fiberG: roundGrams(per(total.fiberG)),
  };
}

export function sameNutrition(a: NutritionPerServing, b: NutritionPerServing): boolean {
  return (
    a.kcal === b.kcal &&
    a.proteinG === b.proteinG &&
    a.carbsG === b.carbsG &&
    a.fatG === b.fatG &&
    a.fiberG === b.fiberG
  );
}

/** Recettes avec `nutritionPerServing` recalculé (ordre des clés conservé). */
export function withComputedNutrition(
  recipes: readonly Recipe[],
  mappings: IngredientMappingFile,
  foods: ReadonlyMap<string, CiqualFood>,
): Recipe[] {
  return recipes.map((recipe) => ({
    ...recipe,
    nutritionPerServing: computeNutritionPerServing(recipe, mappings, foods),
  }));
}

// ------------------------------------------------------------------ Chargement (Node)

const ROOT = new URL('../../', import.meta.url);
export const PATHS = {
  ciqual: fileURLToPath(new URL('data/ciqual/ciqual-2025.json', ROOT)),
  mappings: fileURLToPath(new URL('data/ciqual/ingredients.json', ROOT)),
  recipes: fileURLToPath(new URL('src/infrastructure/data/recipes.json', ROOT)),
} as const;

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

export async function loadNutritionSources(): Promise<{
  foods: ReadonlyMap<string, CiqualFood>;
  mappings: IngredientMappingFile;
}> {
  const table = ciqualTableSchema.parse(await readJson(PATHS.ciqual));
  const mappings = ingredientMappingFileSchema.parse(await readJson(PATHS.mappings));
  return { foods: indexCiqual(table.aliments), mappings };
}

// ------------------------------------------------------------------ CLI

async function main(write: boolean): Promise<number> {
  const { recipesFileSchema } = await import('../../src/infrastructure/data/schemas');
  const { foods, mappings } = await loadNutritionSources();
  const recipes = recipesFileSchema.parse(await readJson(PATHS.recipes));

  const issues = findNutritionIssues(recipes, mappings, foods);
  if (issues.length > 0) {
    for (const issue of issues) console.error(`✘ ${describeIssue(issue)}`);
    return 1;
  }
  const updated = withComputedNutrition(recipes, mappings, foods);
  const stale = updated.filter((recipe, i) => {
    const before = recipes[i];
    return (
      before === undefined || !sameNutrition(recipe.nutritionPerServing, before.nutritionPerServing)
    );
  });
  if (!write) {
    for (const recipe of stale)
      console.error(`✘ ${recipe.id} : valeurs nutritionnelles à recalculer`);
    if (stale.length === 0) console.log('✔ valeurs nutritionnelles à jour');
    return stale.length === 0 ? 0 : 1;
  }
  const { format, resolveConfig } = await import('prettier');
  const options = (await resolveConfig(PATHS.recipes)) ?? {};
  const text = await format(JSON.stringify(updated), { ...options, filepath: PATHS.recipes });
  await writeFile(PATHS.recipes, text, 'utf8');
  console.log(`✔ ${updated.length} recette(s) recalculée(s), ${stale.length} modifiée(s)`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.includes('--write'));
}
