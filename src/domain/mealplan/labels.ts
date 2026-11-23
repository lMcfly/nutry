import type { DayIndex, MealSlot } from './mealplan.types';

export const DAY_NAMES: Readonly<Record<DayIndex, string>> = {
  0: 'lundi',
  1: 'mardi',
  2: 'mercredi',
  3: 'jeudi',
  4: 'vendredi',
  5: 'samedi',
  6: 'dimanche',
};

export const SLOT_NAMES: Readonly<Record<MealSlot, string>> = {
  'petit-dejeuner': 'petit-déjeuner',
  dejeuner: 'déjeuner',
  diner: 'dîner',
};

/** Libellé d'un repas, ex. « mardi – dîner ». */
export function mealLabel(meal: { readonly dayIndex: DayIndex; readonly slot: MealSlot }): string {
  return `${DAY_NAMES[meal.dayIndex]} – ${SLOT_NAMES[meal.slot]}`;
}
