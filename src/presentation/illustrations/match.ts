import { normalizeText } from '@domain/shared';
import type { ProteinType, RecipeTag } from '@domain/recipe';

/** Familles de plats illustrées. */
export const DISH_FAMILIES = [
  'salade',
  'bowl',
  'soupe',
  'pates',
  'riz',
  'curry',
  'poisson',
  'volaille',
  'viande',
  'oeufs',
  'legumineuses',
  'tofu',
  'gratin',
  'tarte',
  'petit-dejeuner',
] as const;
export type DishFamily = (typeof DISH_FAMILIES)[number];

/** Ce qu'il faut savoir d'une recette pour choisir son illustration. */
export interface DishSubject {
  readonly name: string;
  readonly tags: readonly RecipeTag[];
  readonly mainProtein: ProteinType;
}

/** Règles par mots du nom, de la plus spécifique à la plus générale (nom normalisé). */
const NAME_RULES: readonly (readonly [RegExp, DishFamily])[] = [
  [/\b(bowl|poke)\b/, 'bowl'],
  [/\b(omelette|frittata|tortilla|chakchouka)\b/, 'oeufs'],
  [/\b(salade|taboule|ceviche)\b/, 'salade'],
  [/\b(veloute|soupe|potage|bouillon)\b/, 'soupe'],
  [/\b(tarte|quiche|galette|feuillete|spanakopita|okonomiyaki)\b/, 'tarte'],
  [/\b(gratin\w*|hachis|parmentier)\b/, 'gratin'],
  [
    /\b(pates|spaghetti|tagliatelles?|gnocchis?|penne|nouilles?|bolognaise|boulettes|pad thai|bo bun)\b/,
    'pates',
  ],
  [/\b(risotto|paella|riz saute|riz cantonais|mujaddara)\b/, 'riz'],
  [/\b(curry|dahl|masala|saag|tajine|yassa|chili|lait de coco)\b/, 'curry'],
  [/\b(wok|tofu|wraps?|tacos?)\b/, 'tofu'],
];

/** Famille par protéine principale, quand le nom ne dit rien de plus précis. */
const PROTEIN_FAMILY: Readonly<Record<ProteinType, DishFamily>> = {
  boeuf: 'viande',
  porc: 'viande',
  agneau: 'viande',
  volaille: 'volaille',
  poisson: 'poisson',
  'fruits-de-mer': 'poisson',
  oeufs: 'oeufs',
  legumineuses: 'legumineuses',
  'soja-tofu': 'tofu',
  fromage: 'gratin',
  aucune: 'bowl',
};

/**
 * Choisit l'illustration d'une recette : petit-déjeuner d'après l'étiquette, puis mots du
 * nom (« bowl », « gratin »…), puis protéine principale. Toujours une famille valide.
 */
export function pickDishFamily(recipe: DishSubject): DishFamily {
  if (recipe.tags.includes('petit-dejeuner')) return 'petit-dejeuner';
  const name = normalizeText(recipe.name);
  for (const [pattern, family] of NAME_RULES) {
    // « wrap », « tacos » ou « wok » ne disent pas la garniture : l'illustration tofu
    // n'est choisie que si le tofu est bien la protéine (sinon, repli sur la protéine).
    if (family === 'tofu' && recipe.mainProtein !== 'soja-tofu') continue;
    if (pattern.test(name)) return family;
  }
  return PROTEIN_FAMILY[recipe.mainProtein];
}
