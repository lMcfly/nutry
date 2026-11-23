import { tokenize } from '../shared';

/**
 * Synonymes des aliments « génériques » saisis dans les goûts (aimés ou détestés) :
 * « viande » couvre bœuf, porc, poulet… Clés et valeurs sont comparées sans accents,
 * casse ni pluriel simple. Un terme absent de la table ne désigne que lui-même.
 */
const MEATS = [
  'viande',
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
  'lardon',
  'jambon',
  'saucisse',
  'saucisson',
  'chorizo',
  'merguez',
  'bacon',
  'steak haché',
];
const FISHES = [
  'poisson',
  'saumon',
  'cabillaud',
  'thon',
  'sardine',
  'maquereau',
  'colin',
  'merlu',
  'lieu',
  'truite',
  'dorade',
  'sole',
  'anchois',
  'hareng',
  'églefin',
];
const SEAFOOD = [
  'fruits de mer',
  'crevette',
  'gambas',
  'moule',
  'calamar',
  'encornet',
  'poulpe',
  'seiche',
  'crabe',
  'homard',
  'langoustine',
  'saint jacques',
  'huître',
  'palourde',
];
export const CHEESES = [
  'fromage',
  'parmesan',
  'comté',
  'emmental',
  'gruyère',
  'mozzarella',
  'burrata',
  'feta',
  'chèvre',
  'ricotta',
  'mascarpone',
  'cheddar',
  'roquefort',
  'camembert',
  'brie',
  'reblochon',
  'raclette',
  'halloumi',
  'pecorino',
  'paneer',
  'grana padano',
  'gorgonzola',
  'beaufort',
];
const PULSES = [
  'légumineuses',
  'lentille',
  'pois chiche',
  'haricot rouge',
  'haricot blanc',
  'haricot noir',
  'flageolet',
  'pois cassé',
  'fève',
];

export const FOOD_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  viande: MEATS,
  poisson: FISHES,
  'fruits de mer': SEAFOOD,
  fromage: CHEESES,
  porc: ['porc', 'lardon', 'jambon', 'chorizo', 'saucisse', 'saucisson', 'bacon', 'rillettes'],
  volaille: ['volaille', 'poulet', 'dinde', 'canard', 'pintade'],
  légumineuses: PULSES,
  champignons: ['champignon', 'cèpe', 'girolle', 'pleurote', 'shiitake', 'morille'],
  poivron: ['poivron'],
  coriandre: ['coriandre'],
  olives: ['olive', 'tapenade'],
  épicé: [
    'piment',
    'harissa',
    'curry fort',
    'pâte de curry',
    'sriracha',
    'tabasco',
    'wasabi',
    'sambal',
  ],
};

const SYNONYMS_BY_KEY = new Map(
  Object.entries(FOOD_SYNONYMS).map(([key, terms]) => [tokenize(key).join(' '), terms]),
);

/** Termes couverts par une saisie : elle-même, plus ses synonymes éventuels. */
export function expandFoodTerm(term: string): readonly string[] {
  const synonyms = SYNONYMS_BY_KEY.get(tokenize(term).join(' '));
  return synonyms ? [term, ...synonyms] : [term];
}

/** Puce de goût proposée à l'onboarding, pour les aliments aimés comme détestés. */
export interface FoodPreferenceChip {
  readonly label: string;
  readonly emoji: string;
  /** Terme enregistré dans `Profile.likes` / `Profile.dislikes`. */
  readonly term: string;
}

export const FOOD_PREFERENCE_CHIPS: readonly FoodPreferenceChip[] = [
  { label: 'Viande', emoji: '🥩', term: 'viande' },
  { label: 'Volaille', emoji: '🍗', term: 'volaille' },
  { label: 'Porc', emoji: '🥓', term: 'porc' },
  { label: 'Bœuf', emoji: '🐄', term: 'boeuf' },
  { label: 'Poisson', emoji: '🐟', term: 'poisson' },
  { label: 'Saumon', emoji: '🍣', term: 'saumon' },
  { label: 'Fruits de mer', emoji: '🦐', term: 'fruits de mer' },
  { label: 'Œufs', emoji: '🥚', term: 'oeufs' },
  { label: 'Fromage', emoji: '🧀', term: 'fromage' },
  { label: 'Tofu', emoji: '🌱', term: 'tofu' },
  { label: 'Légumineuses', emoji: '🫘', term: 'légumineuses' },
  { label: 'Champignons', emoji: '🍄', term: 'champignons' },
  { label: 'Poivron', emoji: '🫑', term: 'poivron' },
  { label: 'Tomate', emoji: '🍅', term: 'tomate' },
  { label: 'Courgette', emoji: '🥒', term: 'courgette' },
  { label: 'Brocoli', emoji: '🥦', term: 'brocoli' },
  { label: 'Épinards', emoji: '🥬', term: 'épinards' },
  { label: 'Avocat', emoji: '🥑', term: 'avocat' },
  { label: 'Coriandre', emoji: '🌿', term: 'coriandre' },
  { label: 'Olives', emoji: '🫒', term: 'olives' },
  { label: 'Épicé', emoji: '🌶️', term: 'épicé' },
  { label: 'Riz', emoji: '🍚', term: 'riz' },
  { label: 'Pâtes', emoji: '🍝', term: 'pâtes' },
  { label: 'Pomme de terre', emoji: '🥔', term: 'pomme de terre' },
];
