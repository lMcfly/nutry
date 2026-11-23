import { describe, expect, it } from 'vitest';
import {
  addDays,
  ceilTo,
  clamp,
  containsAnyTerm,
  containsTerm,
  createSeededRng,
  dayOfWeek,
  daysBetween,
  isIsoDate,
  isoWeekKey,
  isWeekend,
  monthOf,
  normalizeText,
  randomIndex,
  roundTo,
  startOfWeek,
  toIsoDate,
  toUtcDate,
  tokenize,
} from './index';

describe('dates ISO', () => {
  it('valide et convertit les dates', () => {
    expect(isIsoDate('2026-11-23')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('23/11/2026')).toBe(false);
    expect(() => toUtcDate('2026-13-01')).toThrow(RangeError);
    expect(toIsoDate(toUtcDate('2024-02-29'))).toBe('2024-02-29');
  });

  it('calcule jours, semaines et mois', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-23', '2026-11-30')).toBe(7);
    expect(daysBetween('2026-11-30', '2026-11-23')).toBe(-7);
    expect(dayOfWeek('2026-11-23')).toBe(0); // lundi
    expect(dayOfWeek('2026-11-29')).toBe(6); // dimanche
    expect(isWeekend('2026-11-28')).toBe(true);
    expect(isWeekend('2026-11-27')).toBe(false);
    expect(startOfWeek('2026-11-29')).toBe('2026-11-23');
    expect(startOfWeek('2026-11-23')).toBe('2026-11-23');
    expect(monthOf('2026-01-15')).toBe(1);
  });

  it('calcule la semaine ISO 8601, y compris aux bords d’année', () => {
    expect(isoWeekKey('2026-11-23')).toBe('2026-W48');
    expect(isoWeekKey('2021-01-03')).toBe('2020-W53');
    expect(isoWeekKey('2024-12-30')).toBe('2025-W01');
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01');
  });
});

describe('maths', () => {
  it('borne et arrondit', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
    expect(roundTo(12.3, 0.5)).toBe(12.5);
    expect(ceilTo(11, 5)).toBe(15);
    expect(ceilTo(10, 5)).toBe(10);
  });
});

describe('texte', () => {
  it('normalise accents, casse, ligatures et ponctuation', () => {
    expect(normalizeText('  Pavé de SAUMON ')).toBe('pave de saumon');
    expect(normalizeText('Bœuf / Œufs')).toBe('boeuf oeufs');
    expect(normalizeText('Lætitia')).toBe('laetitia');
    expect(tokenize('')).toEqual([]);
    expect(tokenize('Choux, tomates')).toEqual(['chou', 'tomate']);
  });

  it('reconnaît un terme en mots entiers, singulier ou pluriel', () => {
    expect(containsTerm('tomates cerises', 'tomate')).toBe(true);
    expect(containsTerm('Pavé de saumon', 'saumon')).toBe(true);
    expect(containsTerm('pomme de terre', 'pomme de terre')).toBe(true);
    expect(containsTerm('thon', 'on')).toBe(false);
    expect(containsTerm('poivron', 'poivre')).toBe(false);
    expect(containsTerm('saumon', '')).toBe(false);
    expect(containsTerm('sel', 'sel fin de mer')).toBe(false);
    expect(containsAnyTerm('huile d’olive', ['sel', 'huile'])).toBe(true);
    expect(containsAnyTerm('riz', [])).toBe(false);
  });
});

describe('aléa déterministe', () => {
  it('produit la même suite pour la même graine, dans [0, 1)', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const values = Array.from({ length: 100 }, () => a());
    expect(values).toEqual(Array.from({ length: 100 }, () => b()));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(createSeededRng(7)()).not.toBe(createSeededRng(8)());
  });

  it('tire un index valide même pour un aléa extrême', () => {
    expect(randomIndex(3, () => 0)).toBe(0);
    expect(randomIndex(3, () => 0.999999)).toBe(2);
    expect(randomIndex(3, () => 1)).toBe(2);
  });
});
