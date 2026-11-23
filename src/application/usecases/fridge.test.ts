import { describe, expect, it } from 'vitest';
import { createInMemoryPorts } from '../testing';
import { createUseCases } from '.';
import { containsAllergen } from '@domain/recipe';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';

describe('frigo vide', () => {
  it('liste les ingrédients du catalogue sans basiques ni doublons', async () => {
    const uc = createUseCases(createInMemoryPorts({ recipes: FIXTURE_RECIPES }));
    const names = await uc.listFridgeIngredients();
    expect(names).toContain('lentilles corail');
    expect(names).not.toContain('sel');
    expect(new Set(names).size).toBe(names.length);
    expect([...names]).toEqual([...names].sort((a, b) => a.localeCompare(b, 'fr')));
  });

  it('demande un profil puis respecte ses allergies', async () => {
    const uc = createUseCases(createInMemoryPorts({ recipes: FIXTURE_RECIPES }));
    await expect(uc.suggestFromFridge({ available: ['oeufs'] })).resolves.toEqual({
      status: 'no-profile',
    });
    await uc.saveProfile(makeProfile({ allergens: ['oeufs'] }));
    const result = await uc.suggestFromFridge({ available: ['oeufs', 'tomates'], limit: 3 });
    if (result.status !== 'ready') throw new Error('suggestions attendues');
    expect(result.suggestions.length).toBeLessThanOrEqual(3);
    for (const s of result.suggestions) expect(containsAllergen(s.recipe, ['oeufs'])).toBe(false);
    const all = await uc.suggestFromFridge({ available: ['tomates'] });
    expect(all.status).toBe('ready');
  });
});
