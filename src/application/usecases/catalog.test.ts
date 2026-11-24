import { describe, expect, it } from 'vitest';
import { FixedClock, createInMemoryPorts } from '../testing';
import { FIXTURE_RECIPES } from '@domain/testing/fixtures';
import type { RecipePhoto } from '../ports';
import { licenseLabel } from './catalog';
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

describe('photos des plats', () => {
  const [first, second] = FIXTURE_RECIPES;
  if (!first || !second) throw new Error('fixture');
  const photo = (recipeId: string, overrides: Partial<RecipePhoto> = {}): RecipePhoto => ({
    recipeId,
    provider: 'wikimedia',
    src: `/nutry/photos/${recipeId}.webp`,
    title: 'Plat.jpg',
    author: 'Auteur',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Plat.jpg',
    modified: 'recadrée et compressée',
    approximate: false,
    ...overrides,
  });

  it('getPhotoImages : adresse et variantes par recette illustrée, rien pour les autres', async () => {
    const uc = createUseCases(
      createInMemoryPorts({
        recipes: FIXTURE_RECIPES,
        photos: [photo(first.id), photo(second.id, { srcSet: 'a 400w, b 800w' })],
      }),
    );
    await expect(uc.getPhotoImages()).resolves.toEqual({
      [first.id]: { src: `/nutry/photos/${first.id}.webp`, srcSet: undefined },
      [second.id]: { src: `/nutry/photos/${second.id}.webp`, srcSet: 'a 400w, b 800w' },
    });
  });

  it('listPhotoCredits : nom du plat, licence lisible, ordre alphabétique, orphelines écartées', async () => {
    const a = { ...first, name: 'Zèbre' };
    const b = { ...second, name: 'Abricot' };
    const uc = createUseCases(
      createInMemoryPorts({
        recipes: [a, b],
        photos: [photo(a.id), photo(b.id, { license: 'PD', approximate: true }), photo('disparue')],
      }),
    );
    const credits = await uc.listPhotoCredits();
    expect(credits.map((c) => c.dishName)).toEqual(['Abricot', 'Zèbre']);
    expect(credits[0]).toMatchObject({ licenseLabel: 'Domaine public', illustrative: true });
    expect(credits[1]).toMatchObject({
      licenseLabel: 'CC BY-SA 4.0',
      illustrative: false,
      modified: 'recadrée et compressée',
    });
    expect(licenseLabel('CC0')).toBe('CC0');
    expect(licenseLabel('Unsplash')).toBe('Licence Unsplash');
  });
});
