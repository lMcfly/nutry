import { describe, expect, it } from 'vitest';
import { FIXTURE_RECIPES, fixture } from '../testing/fixtures';
import {
  FOOD_PREFERENCE_CHIPS,
  FOOD_SYNONYMS,
  expandFoodTerm,
  filterCompatibleRecipes,
  recipeMentions,
} from './index';

const without = (dislike: string) =>
  filterCompatibleRecipes(FIXTURE_RECIPES, { diets: [], allergens: [], dislikes: [dislike] }).map(
    (r) => r.id,
  );

describe('synonymes des aliments génériques', () => {
  it('étend un terme générique, quelle que soit la casse, l’accent ou le pluriel', () => {
    expect(expandFoodTerm('viande')).toContain('poulet');
    expect(expandFoodTerm('Viandes')).toContain('jambon');
    expect(expandFoodTerm('EPICE')).toContain('harissa');
    expect(expandFoodTerm('champignon')).toContain('girolle');
    expect(expandFoodTerm('kiwi')).toEqual(['kiwi']);
  });

  it('« viande » exclut toutes les recettes de viande, et seulement elles', () => {
    const ids = without('viande');
    for (const id of [
      'poulet-roti-legumes',
      'boeuf-carottes',
      'porc-moutarde',
      'tajine-agneau',
      'dinde-patate-douce',
      'porc-saute-chou',
    ]) {
      expect(ids).not.toContain(id);
    }
    expect(ids).toContain('saumon-haricots-verts');
    expect(ids).toContain('dahl-lentilles-corail');
  });

  it('« poisson » couvre saumon, cabillaud, thon ; « fruits de mer » crevettes et moules', () => {
    const fish = without('poissons');
    expect(fish).not.toContain('saumon-haricots-verts');
    expect(fish).not.toContain('cabillaud-papillote-fenouil');
    expect(fish).not.toContain('salade-nicoise');
    expect(fish).toContain('curry-crevettes-coco');
    const seafood = without('fruits de mer');
    expect(seafood).not.toContain('curry-crevettes-coco');
    expect(seafood).not.toContain('moules-marinieres');
    expect(seafood).toContain('saumon-haricots-verts');
  });

  it('« fromage » couvre parmesan et emmental ; « porc » couvre le porc émincé', () => {
    const cheese = without('fromage');
    expect(cheese).not.toContain('pates-pesto-courgettes');
    expect(cheese).not.toContain('omelette-champignons');
    expect(cheese).not.toContain('risotto-courge');
    expect(cheese).toContain('dahl-lentilles-corail');
    expect(without('porc')).not.toContain('porc-saute-chou');
  });

  it('« épicé », « champignons », « légumineuses »', () => {
    expect(without('épicé')).not.toContain('curry-crevettes-coco');
    expect(without('champignons')).not.toContain('omelette-champignons');
    const pulses = without('légumineuses');
    expect(pulses).not.toContain('taboule-pois-chiches');
    expect(pulses).not.toContain('soupe-poireaux-haricots');
    expect(pulses).toContain('saumon-haricots-verts');
  });

  it('s’applique aussi aux aliments aimés', () => {
    expect(recipeMentions(fixture('dinde-patate-douce'), 'volaille')).toBe(true);
    expect(recipeMentions(fixture('salade-nicoise'), 'poisson')).toBe(true);
  });

  it('a des clés et des valeurs non vides', () => {
    for (const [key, terms] of Object.entries(FOOD_SYNONYMS)) {
      expect(key.trim()).not.toBe('');
      expect(terms.length).toBeGreaterThan(0);
    }
  });
});

describe('puces de goûts', () => {
  it('propose une vingtaine de puces uniques, avec libellé, emoji et terme', () => {
    expect(FOOD_PREFERENCE_CHIPS.length).toBeGreaterThanOrEqual(18);
    expect(FOOD_PREFERENCE_CHIPS.length).toBeLessThanOrEqual(26);
    expect(new Set(FOOD_PREFERENCE_CHIPS.map((c) => c.term)).size).toBe(
      FOOD_PREFERENCE_CHIPS.length,
    );
    for (const chip of FOOD_PREFERENCE_CHIPS) {
      expect(chip.label.trim()).not.toBe('');
      expect(chip.emoji.trim()).not.toBe('');
      expect(chip.term.trim()).not.toBe('');
    }
  });

  it('chaque puce désigne au moins une recette du catalogue de test', () => {
    for (const chip of FOOD_PREFERENCE_CHIPS.filter(
      (c) => !['avocat', 'olives'].includes(c.term),
    )) {
      expect(
        FIXTURE_RECIPES.some((r) => recipeMentions(r, chip.term)),
        chip.term,
      ).toBe(true);
    }
  });
});
