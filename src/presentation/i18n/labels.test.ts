import { describe, expect, it } from 'vitest';
import { COMPANION_ACCESSORIES, COMPANION_COLORS, COMPANION_EYES } from '@domain/companion';
import { DAY_INDEXES, MEAL_SLOTS } from '@domain/mealplan';
import { RATING_REASONS } from '@domain/preferences';
import { ACTIVITY_LEVELS, GOALS, SEXES } from '@domain/profile';
import { QUIZ_CATEGORIES } from '@domain/quiz';
import { AISLES, ALLERGENS, DIETS, LEVELS, PROTEIN_TYPES } from '@domain/recipe';
import { SHOPPING_SECTIONS } from '@domain/shopping';
import { THEMES } from '@domain/userdata';
import * as labels from './labels';

const CASES: readonly (readonly [string, readonly string[], Readonly<Record<string, string>>])[] = [
  ['niveaux', LEVELS, labels.LEVEL_LABELS],
  ['explications des niveaux', LEVELS, labels.LEVEL_HINTS],
  ['emojis des niveaux', LEVELS, labels.LEVEL_EMOJIS],
  ['régimes', DIETS, labels.DIET_LABELS],
  ['allergènes', ALLERGENS, labels.ALLERGEN_LABELS],
  ['protéines', PROTEIN_TYPES, labels.PROTEIN_LABELS],
  ['rayons', AISLES, labels.AISLE_LABELS],
  ['sections de courses', SHOPPING_SECTIONS, labels.SECTION_TITLES],
  ['emojis des sections', SHOPPING_SECTIONS, labels.SECTION_EMOJIS],
  ['sexes', SEXES, labels.SEX_LABELS],
  ['activités', ACTIVITY_LEVELS, labels.ACTIVITY_LABELS],
  ['explications des activités', ACTIVITY_LEVELS, labels.ACTIVITY_HINTS],
  ['emojis des activités', ACTIVITY_LEVELS, labels.ACTIVITY_EMOJIS],
  ['objectifs', GOALS, labels.GOAL_LABELS],
  ['explications des objectifs', GOALS, labels.GOAL_HINTS],
  ['emojis des objectifs', GOALS, labels.GOAL_EMOJIS],
  ['raisons d’avis', RATING_REASONS, labels.RATING_REASON_LABELS],
  ['créneaux', MEAL_SLOTS, labels.SLOT_LABELS],
  ['emojis des créneaux', MEAL_SLOTS, labels.SLOT_EMOJIS],
  ['jours', DAY_INDEXES.map(String), labels.DAY_LABELS],
  ['jours abrégés', DAY_INDEXES.map(String), labels.DAY_SHORT_LABELS],
  ['créneaux courts', MEAL_SLOTS, labels.SLOT_SHORT_LABELS],
  ['rayons courts', SHOPPING_SECTIONS, labels.SECTION_SHORT_LABELS],
  ['catégories du quiz', QUIZ_CATEGORIES, labels.QUIZ_CATEGORY_LABELS],
  ['thèmes', THEMES, labels.THEME_LABELS],
];

describe('libellés français', () => {
  it.each(CASES)('aucun libellé manquant : %s', (_name, values, map) => {
    for (const value of values) {
      expect(map[value], value).toBeTruthy();
    }
    // Pas de clé orpheline (valeur retirée du domain).
    expect(Object.keys(map).sort()).toEqual([...values].sort());
  });

  it('chaque élément à débloquer de Nutry a sa phrase avec article', () => {
    const ids = [...COMPANION_COLORS, ...COMPANION_EYES, ...COMPANION_ACCESSORIES]
      .filter((item) => item.unlockAt > 0)
      .map((item) => item.id);
    expect(Object.keys(labels.UNLOCK_PHRASES).sort()).toEqual([...ids].sort());
    const toque = COMPANION_ACCESSORIES.find((a) => a.id === 'toque-de-chef');
    if (!toque) throw new Error('toque absente');
    expect(labels.unlockPhrase(toque)).toBe('la toque de chef');
    expect(labels.joinPhrases(['la toque', 'l’écharpe'])).toBe('la toque et l’écharpe');
    expect(labels.joinPhrases(['a', 'b', 'c'])).toBe('a, b et c');
    expect(labels.joinPhrases(['a'])).toBe('a');
  });

  it('formate durées, dates et nombres', () => {
    expect(labels.formatMinutes(25)).toBe('25 min');
    expect(labels.formatMinutes(60)).toBe('1 h');
    expect(labels.formatMinutes(75)).toBe('1 h 15');
    expect(labels.formatDayLong('2026-11-23')).toBe('Lundi 23 novembre');
    expect(labels.formatDayShort('2026-11-23')).toMatch(/23 nov/);
    expect(labels.formatDayOfMonth('2026-11-23')).toBe('23');
    expect(labels.formatDateFull('2026-11-23')).toBe('23 novembre 2026');
    expect(labels.formatDecimal(72.5)).toBe('72,5');
    expect(labels.plural(1, 'repas', 'repas')).toBe('1 repas');
    expect(labels.plural(2, 'personne')).toBe('2 personnes');
  });
});
