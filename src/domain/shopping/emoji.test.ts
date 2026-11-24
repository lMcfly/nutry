import { describe, expect, it } from 'vitest';
import { ingredientEmoji } from './emoji';

describe('ingredientEmoji', () => {
  it.each([
    ['ail', '🧄'],
    ['Carottes', '🥕'],
    ['pommes de terre', '🥔'],
    ['pommes', '🍎'],
    ['lait de coco allégé', '🥥'],
    ['lait demi-écrémé', '🥛'],
    ['pâte feuilletée pur beurre', '🥐'],
    ['vinaigre de riz', '🥫'],
    ['petits pois surgelés', '🫛'],
    ['œufs', '🥚'],
    ['oeufs', '🥚'],
    ['courgettes', '🥒'],
    ['pavés de saumon', '🐟'],
  ])('%s → %s', (name, emoji) => {
    expect(ingredientEmoji(name)).toBe(emoji);
  });

  it('inconnu : aucun emoji (l’écran se rabat sur le rayon)', () => {
    expect(ingredientEmoji('machin truc')).toBeUndefined();
    expect(ingredientEmoji('')).toBeUndefined();
  });
});
