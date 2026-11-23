import { describe, expect, it } from 'vitest';
import { FIXTURE_RECIPES } from '../testing/fixtures';
import { BASIC_INGREDIENTS, suggestFromFridge } from './index';

const none = { diets: [], allergens: [], dislikes: [] } as const;

describe('frigo vide', () => {
  it('exporte la liste des basiques ignorés', () => {
    expect(BASIC_INGREDIENTS).toEqual(['sel', 'poivre', 'huile', 'eau']);
  });

  it('trie par nombre d’ingrédients manquants, en ignorant les basiques', () => {
    const result = suggestFromFridge({
      constraints: none,
      recipes: FIXTURE_RECIPES,
      available: ['escalope de dinde', 'patates douces', 'haricots verts', 'riz complet', 'citron'],
    });
    expect(result[0]?.recipe.id).toBe('dinde-patate-douce');
    expect(result[0]?.missing).toEqual([]);
    expect(result[1]?.recipe.id).toBe('saumon-haricots-verts');
    expect(result[1]?.missing.map((i) => i.name)).toEqual(['pavé de saumon']);
    const missing = result.map((s) => s.missing.length);
    expect([...missing].sort((a, b) => a - b)).toEqual(missing);
    expect(result.every((s) => s.matched.length > 0)).toBe(true);
  });

  it('départage par ingrédients utilisés puis par nom, et respecte la limite', () => {
    const result = suggestFromFridge({
      constraints: none,
      recipes: FIXTURE_RECIPES,
      available: ['oignon'],
      limit: 3,
    });
    expect(result).toHaveLength(3);
    const all = suggestFromFridge({
      constraints: none,
      recipes: FIXTURE_RECIPES,
      available: ['oignon'],
    });
    expect(all.length).toBeGreaterThan(3);
  });

  it('applique les filtres durs du profil', () => {
    const result = suggestFromFridge({
      constraints: { diets: ['vegan'], allergens: ['soja'], dislikes: ['lentilles'] },
      recipes: FIXTURE_RECIPES,
      available: ['tofu', 'riz complet', 'lentilles corail', 'tomates'],
    });
    const ids = result.map((s) => s.recipe.id);
    expect(ids).not.toContain('tofu-brocoli-sesame');
    expect(ids).not.toContain('dahl-lentilles-corail');
    expect(ids).not.toContain('saumon-haricots-verts');
    expect(ids).toContain('gaspacho-pois-chiches');
  });

  it('ne propose rien sans ingrédient', () => {
    expect(
      suggestFromFridge({ constraints: none, recipes: FIXTURE_RECIPES, available: [] }),
    ).toEqual([]);
  });
});
