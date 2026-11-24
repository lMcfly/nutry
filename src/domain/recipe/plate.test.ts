import { describe, expect, it } from 'vitest';
import { describePlate, describePlateShare } from './plate';

describe('describePlateShare', () => {
  it.each([
    [0.5, 'environ la moitié'],
    [0.25, 'environ un quart'],
    [0.3, 'environ un tiers'],
    [0.2, 'environ un cinquième'],
    [0.66, 'environ les deux tiers'],
    [0.05, 'une toute petite part'],
    [0.42, 'une bonne part'],
    [0.9, 'presque toute l’assiette'],
  ])('%s → %s', (share, text) => {
    expect(describePlateShare(share)).toBe(text);
  });

  it('décrit l’assiette sans aucun pourcentage', () => {
    const text = describePlate({ vegetables: 0.5, proteins: 0.25, starches: 0.25 });
    expect(text).toBe(
      'légumes : environ la moitié, féculents : environ un quart, protéines : environ un quart',
    );
    expect(text).not.toMatch(/%|pour cent/);
  });
});
