import { containsAnyTerm } from '../shared';
import type { RecipeIngredient } from './recipe.types';

/** Basiques du placard, ignorés par le mode « frigo vide » et le comptage d'ingrédients. */
export const BASIC_INGREDIENTS = ['sel', 'poivre', 'huile', 'eau'] as const;

/** Produits du rayon fruits & légumes qui sont des féculents (donc ajustés comme tels). */
export const STARCHY_PRODUCE = ['pomme de terre', 'patate douce'] as const;

/** Aromates : présents partout, ils ne comptent pas comme légume « varié ». */
export const AROMATICS = [
  'ail',
  'oignon',
  'échalote',
  'persil',
  'ciboulette',
  'coriandre',
  'basilic',
  'menthe',
  'thym',
  'romarin',
  'gingembre',
  'citron',
] as const;

/** Légumineuses (indicateur d'équilibre). */
export const PULSE_TERMS = [
  'lentille',
  'pois chiche',
  'haricot rouge',
  'haricot blanc',
  'haricot noir',
  'flageolet',
  'pois cassé',
  'fève',
  'lupin',
] as const;

/** Céréales complètes ou peu raffinées (indicateur d'équilibre). */
export const WHOLE_GRAIN_TERMS = [
  'complet',
  'complète',
  'avoine',
  'sarrasin',
  'seigle',
  'boulgour',
  'orge',
  'millet',
] as const;

/** Chair animale (viandes, poissons, fruits de mer) et gélatine : interdits en végétarien. */
export const ANIMAL_FLESH_TERMS = [
  'boeuf',
  'veau',
  'porc',
  'agneau',
  'mouton',
  'poulet',
  'dinde',
  'canard',
  'volaille',
  'lapin',
  'jambon',
  'lardon',
  'bacon',
  'saucisse',
  'chorizo',
  'merguez',
  'poisson',
  'saumon',
  'thon',
  'cabillaud',
  'colin',
  'merlu',
  'sardine',
  'maquereau',
  'truite',
  'anchois',
  'crevette',
  'moule',
  'calamar',
  'encornet',
  'crabe',
  'homard',
  'saint jacques',
  'gélatine',
] as const;

/** Produits animaux non carnés interdits en végan en plus des allergènes (lait, œufs…). */
export const VEGAN_EXTRA_TERMS = ['miel'] as const;

export function isBasicIngredient(name: string): boolean {
  return containsAnyTerm(name, BASIC_INGREDIENTS);
}

/**
 * Catégorie d'un ingrédient pour l'ajustement des portions (heuristique documentée,
 * volontairement simple et explicable) :
 * 1. `condiment` : basique (sel, poivre, huile, eau) ou dosé en pincée / cuillère → jamais ajusté ;
 * 2. `legume` : rayon fruits & légumes, sauf pomme de terre et patate douce → jamais réduit ;
 * 3. `proteine-feculent` : tout le reste (viandes, poissons, œufs, laitages, féculents,
 *    légumineuses en boîte…) → suit le facteur de portion de la personne.
 * Protéines et féculents ayant le même facteur, il est inutile de les distinguer.
 */
export type IngredientCategory = 'condiment' | 'legume' | 'proteine-feculent';

const CONDIMENT_UNITS: ReadonlySet<RecipeIngredient['unit']> = new Set([
  'pincee',
  'cuillere-cafe',
  'cuillere-soupe',
]);

export function categorizeIngredient(ingredient: RecipeIngredient): IngredientCategory {
  if (isBasicIngredient(ingredient.name) || CONDIMENT_UNITS.has(ingredient.unit)) {
    return 'condiment';
  }
  if (ingredient.aisle === 'fruits-legumes' && !containsAnyTerm(ingredient.name, STARCHY_PRODUCE)) {
    return 'legume';
  }
  return 'proteine-feculent';
}
