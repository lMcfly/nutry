import { describe, expect, it } from 'vitest';
import quiz from './quiz.json';
import recipes from './recipes.json';
import { quizFileSchema, recipeSchema, recipesFileSchema } from './schemas';

const formatIssues = (issues: readonly { path: (string | number)[]; message: string }[]) =>
  issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');

describe('fichiers de contenu embarqués', () => {
  it('recipes.json respecte le schéma Recipe', () => {
    const result = recipesFileSchema.safeParse(recipes);
    expect(result.success, result.success ? '' : formatIssues(result.error.issues)).toBe(true);
  });

  it('quiz.json respecte le schéma QuizQuestion', () => {
    const result = quizFileSchema.safeParse(quiz);
    expect(result.success, result.success ? '' : formatIssues(result.error.issues)).toBe(true);
  });
});

describe('schémas Zod', () => {
  const [validRecipe] = recipesFileSchema.parse(recipes);

  it('rejette un allergène hors de la liste UE', () => {
    expect(recipeSchema.safeParse({ ...validRecipe, allergens: ['kiwi'] }).success).toBe(false);
  });

  it('rejette une assiette dont les proportions ne somment pas à 1', () => {
    const plateBalance = { vegetables: 0.5, proteins: 0.5, starches: 0.5 };
    expect(recipeSchema.safeParse({ ...validRecipe, plateBalance }).success).toBe(false);
  });

  it('rejette les identifiants en double', () => {
    expect(recipesFileSchema.safeParse([validRecipe, validRecipe]).success).toBe(false);
  });

  it('rejette une question sans exactement 4 choix', () => {
    const [question] = quizFileSchema.parse(quiz);
    const invalid = { ...question, choices: ['a', 'b', 'c'] };
    expect(quizFileSchema.safeParse([invalid]).success).toBe(false);
  });
});
