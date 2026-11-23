import { describe, expect, it } from 'vitest';
import { FixedClock, createInMemoryPorts } from '../testing';
import { FIXTURE_RECIPES } from '@domain/testing/fixtures';
import { createUseCases } from './index';

describe('catalogue et calendrier', () => {
  it('getRecipe : trouve une recette du catalogue, même hors menu', async () => {
    const uc = createUseCases(createInMemoryPorts({ recipes: FIXTURE_RECIPES }));
    const recipe = FIXTURE_RECIPES[3];
    if (!recipe) throw new Error('fixture');
    await expect(uc.getRecipe(recipe.id)).resolves.toEqual(recipe);
    await expect(uc.getRecipe('inconnue')).resolves.toBeUndefined();
  });

  it('today : jour local donné par le port Clock', () => {
    const clock = new FixedClock('2026-11-25T08:00:00.000Z');
    const uc = createUseCases(createInMemoryPorts({ clock }));
    expect(uc.today()).toBe('2026-11-25');
    clock.set('2026-11-30T08:00:00.000Z');
    expect(uc.today()).toBe('2026-11-30');
  });
});
