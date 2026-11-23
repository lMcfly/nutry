import { describe, expect, it } from 'vitest';
import {
  SEASONAL_PRODUCE,
  SEASONS,
  findProduce,
  isProduceInSeason,
  produceInSeason,
  seasonOf,
  seasonOfMonth,
} from './index';

describe('saisons', () => {
  it.each([
    ['2026-03-01', 'printemps'],
    ['2026-05-31', 'printemps'],
    ['2026-06-01', 'ete'],
    ['2026-08-31', 'ete'],
    ['2026-09-01', 'automne'],
    ['2026-11-30', 'automne'],
    ['2026-12-01', 'hiver'],
    ['2027-02-28', 'hiver'],
  ])('%s → %s', (date, season) => {
    expect(seasonOf(date)).toBe(season);
  });

  it('refuse un mois invalide', () => {
    expect(() => seasonOfMonth(0)).toThrow(RangeError);
    expect(() => seasonOfMonth(13)).toThrow(RangeError);
    expect(() => seasonOfMonth(1.5)).toThrow(RangeError);
    expect(SEASONS).toContain(seasonOfMonth(1));
  });
});

describe('calendrier des fruits et légumes', () => {
  it('compte une quarantaine de produits, aux mois valides et sans doublon', () => {
    expect(SEASONAL_PRODUCE.length).toBeGreaterThanOrEqual(40);
    expect(new Set(SEASONAL_PRODUCE.map((p) => p.name)).size).toBe(SEASONAL_PRODUCE.length);
    for (const produce of SEASONAL_PRODUCE) {
      expect(produce.months.length).toBeGreaterThan(0);
      expect(new Set(produce.months).size).toBe(produce.months.length);
      expect(produce.months.every((m) => Number.isInteger(m) && m >= 1 && m <= 12)).toBe(true);
    }
  });

  it('propose des produits de saison chaque mois', () => {
    for (let month = 1; month <= 12; month += 1) {
      const kinds = new Set(produceInSeason(month).map((p) => p.kind));
      expect(kinds.has('legume')).toBe(true);
    }
  });

  it('gère les périodes à cheval sur deux années', () => {
    const kiwi = findProduce('kiwis');
    expect(kiwi?.months).toEqual([11, 12, 1, 2, 3]);
    expect(findProduce('carottes')?.months).toHaveLength(12);
  });

  it('associe un ingrédient au produit le plus spécifique', () => {
    expect(findProduce('chou de Bruxelles')?.name).toBe('chou de Bruxelles');
    expect(findProduce('chou-fleur')?.name).toBe('chou-fleur');
    expect(findProduce('pommes de terre')?.name).toBe('pomme de terre');
    expect(findProduce('courgettes')?.name).toBe('courgette');
    expect(findProduce('riz complet')).toBeUndefined();
  });

  it('indique si un ingrédient est de saison', () => {
    expect(isProduceInSeason('tomates cerises', 7)).toBe(true);
    expect(isProduceInSeason('tomates cerises', 1)).toBe(false);
    expect(isProduceInSeason('riz', 7)).toBe(false);
  });
});
