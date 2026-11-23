import { z } from 'zod';
import { QUIZ_CATEGORIES, QUIZ_DIFFICULTIES, type QuizQuestion } from '@domain/quiz';
import {
  AISLES,
  ALLERGENS,
  DIETS,
  LEVELS,
  PROTEIN_TYPES,
  RECIPE_TAGS,
  UNITS,
  checkAllergenDeclarations,
  checkDietConsistency,
  type Recipe,
} from '@domain/recipe';
import { SEASONS } from '@domain/season';

/**
 * Schémas Zod des fichiers de contenu embarqués.
 * Les énumérations sont dérivées des constantes `as const` du domain : une
 * valeur ajoutée côté domain est automatiquement acceptée ici.
 * Voir docs/adr/0005-zod-validation-donnees.md.
 */

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const id = z.string().regex(ID_PATTERN, 'identifiant attendu en kebab-case ASCII');
const nonEmptyText = z.string().trim().min(1);
const uniqueList = <T extends z.ZodType>(item: T, minLength = 0) =>
  z
    .array(item)
    .min(minLength)
    .refine((values) => new Set(values).size === values.length, 'valeurs en double');

const ingredientSchema = z.object({
  name: nonEmptyText,
  quantity: z.number().positive(),
  unit: z.enum(UNITS),
  aisle: z.enum(AISLES),
});

const plateBalanceSchema = z
  .object({
    vegetables: z.number().min(0).max(1),
    proteins: z.number().min(0).max(1),
    starches: z.number().min(0).max(1),
  })
  .refine(
    (p) => Math.abs(p.vegetables + p.proteins + p.starches - 1) <= 0.01,
    'la somme des proportions de l’assiette doit valoir 1',
  );

const nutritionSchema = z.object({
  kcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative(),
});

export const recipeSchema: z.ZodType<Recipe> = z
  .object({
    id,
    name: nonEmptyText,
    level: z.enum(LEVELS),
    prepMinutes: z.number().int().nonnegative(),
    cookMinutes: z.number().int().nonnegative(),
    servings: z.number().int().positive(),
    diets: uniqueList(z.enum(DIETS), 1),
    allergens: uniqueList(z.enum(ALLERGENS)),
    mainProtein: z.enum(PROTEIN_TYPES),
    seasons: uniqueList(z.enum(SEASONS), 1),
    ingredients: z.array(ingredientSchema).min(1),
    steps: z.array(nonEmptyText).min(1),
    plateBalance: plateBalanceSchema,
    nutritionPerServing: nutritionSchema,
    tags: uniqueList(z.enum(RECIPE_TAGS)),
  })
  .strict()
  .superRefine((recipe, ctx) => {
    // Cohérence régime ↔ allergènes / protéine / ingrédients (règles du domain).
    for (const issue of checkDietConsistency(recipe)) {
      ctx.addIssue({ code: 'custom', path: ['diets'], message: issue.message });
    }
    // Un ingrédient révélant un allergène (crème → lait, sauce soja → soja + gluten…) l'impose.
    for (const issue of checkAllergenDeclarations(recipe)) {
      ctx.addIssue({ code: 'custom', path: ['allergens'], message: issue.message });
    }
  });

const choice = nonEmptyText;

export const quizQuestionSchema: z.ZodType<QuizQuestion> = z
  .object({
    id,
    question: nonEmptyText,
    choices: z
      .tuple([choice, choice, choice, choice])
      .refine((c) => new Set(c.map((s) => s.toLowerCase())).size === 4, 'choix en double'),
    correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    explanation: nonEmptyText,
    category: z.enum(QUIZ_CATEGORIES),
    difficulty: z.enum(QUIZ_DIFFICULTIES),
  })
  .strict();

const withUniqueIds = <T extends { id: string }>(schema: z.ZodType<T>) =>
  z.array(schema).superRefine((items, ctx) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.id)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: `identifiant en double : ${item.id}`,
        });
      }
      seen.add(item.id);
    });
  });

export const recipesFileSchema = withUniqueIds(recipeSchema);
export const quizFileSchema = withUniqueIds(quizQuestionSchema);
