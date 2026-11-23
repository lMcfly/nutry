/** Catégories du quiz : ~20 % `cuisine`, le reste en culture générale (PROMPT.md §3.7). */
export const QUIZ_CATEGORIES = [
  'histoire',
  'geographie',
  'sciences',
  'arts',
  'sport',
  'nature',
  'cuisine',
] as const;
export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];

export const QUIZ_DIFFICULTIES = ['facile', 'moyen', 'difficile'] as const;
export type QuizDifficulty = (typeof QUIZ_DIFFICULTIES)[number];

/** Nombre de choix proposés par question. */
export const QUIZ_CHOICES_COUNT = 4;
