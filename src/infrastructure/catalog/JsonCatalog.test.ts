import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_RECIPES } from '@domain/testing/fixtures';
import {
  JsonQuizRepository,
  JsonRecipeRepository,
  loadEmbeddedQuiz,
  loadEmbeddedRecipes,
} from './JsonCatalog';

describe('catalogues JSON embarqués', () => {
  it('charge et valide les recettes et le quiz réels', async () => {
    const recipes = await loadEmbeddedRecipes();
    expect(recipes.length).toBeGreaterThan(0);
    const questions = await loadEmbeddedQuiz();
    expect(questions.length).toBeGreaterThan(0);
  });

  it('charge une seule fois et indexe par identifiant', async () => {
    const load = vi.fn(() => Promise.resolve(FIXTURE_RECIPES));
    const repo = new JsonRecipeRepository(load);
    await repo.getAll();
    await repo.getAll();
    const first = FIXTURE_RECIPES[0];
    await expect(repo.getById(first?.id ?? '')).resolves.toBe(first);
    await expect(repo.getById('inconnue')).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('remonte une erreur claire et permet un nouvel essai', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('Catalogue de recettes invalide : 0.id: requis'))
      .mockRejectedValueOnce(new Error('réseau'))
      .mockResolvedValue(FIXTURE_RECIPES);
    const repo = new JsonRecipeRepository(load);
    await expect(repo.getAll()).rejects.toThrow(/Catalogue de recettes invalide/);
    await expect(repo.getById('x')).rejects.toThrow('réseau');
    await expect(repo.getById(FIXTURE_RECIPES[0]?.id ?? '')).resolves.toBeDefined();
  });

  it('banque de questions paresseuse', async () => {
    const load = vi.fn(() => Promise.resolve([]));
    const repo = new JsonQuizRepository(load);
    expect(load).not.toHaveBeenCalled();
    await expect(repo.getQuestions()).resolves.toEqual([]);
    await repo.getQuestions();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
