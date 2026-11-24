import { normalizeText } from '../shared';

/**
 * Emoji d'un aliment de la liste de courses (visuel des tuiles). Les règles sont lues dans
 * l'ordre : la première dont un des mots (normalisés, sans accents) figure dans le nom gagne,
 * donc le plus précis passe avant le plus général (« pomme de terre » avant « pomme »).
 * Sans correspondance : `undefined`, l'écran se rabat sur l'emoji du rayon.
 */
const RULES: readonly (readonly [emoji: string, terms: readonly string[]])[] = [
  ['🥐', ['pate feuilletee', 'pate filo']],
  ['🥫', ['vinaigre', 'nuoc mam', 'tamarin', 'sauce']],
  ['🌱', ['pousse', 'germe']],
  ['🥔', ['pomme de terre', 'pommes de terre', 'patate', 'gnocchi']],
  ['🥥', ['lait de coco', 'noix de coco']],
  ['🥜', ['cacahuete', 'arachide', 'amande', 'noix de cajou', 'noix', 'purée de cacahuète']],
  ['🧄', ['ail']],
  ['🧅', ['oignon', 'echalote', 'ciboulette']],
  ['🥕', ['carotte', 'navet']],
  ['🍅', ['tomate', 'ketchup']],
  ['🥒', ['concombre', 'courgette']],
  ['🍆', ['aubergine']],
  ['🥑', ['avocat']],
  ['🥦', ['brocoli', 'chou', 'pak choi', 'romanesco']],
  ['🌶️', ['piment', 'paprika', 'cayenne']],
  ['🫑', ['poivron']],
  ['🍄', ['champignon']],
  ['🥬', ['salade', 'epinard', 'endive', 'roquette', 'poireau']],
  [
    '🌿',
    [
      'basilic',
      'persil',
      'menthe',
      'coriandre',
      'aneth',
      'thym',
      'origan',
      'laurier',
      'herbes',
      'citronnelle',
      'fenouil',
    ],
  ],
  ['🫚', ['gingembre', 'curcuma']],
  ['🌽', ['mais']],
  ['🫓', ['tortilla', 'wrap']],
  ['🫛', ['petit pois', 'edamame', 'haricot vert', 'pois chiche', 'flageolet']],
  ['🫘', ['haricot', 'lentille', 'feve']],
  ['🎃', ['courge', 'potiron', 'butternut']],
  ['🍠', ['patate douce']],
  ['🍋', ['citron']],
  ['🍊', ['orange']],
  ['🍍', ['ananas']],
  ['🍌', ['banane']],
  ['🥭', ['mangue']],
  ['🍐', ['poire']],
  ['🍓', ['framboise', 'fraise']],
  ['🍎', ['pomme', 'compote']],
  ['🍇', ['raisin', 'pruneau']],
  ['🍯', ['miel', 'sirop d erable']],
  ['🧈', ['beurre']],
  ['🥚', ['oeuf']],
  ['🧀', ['fromage', 'emmental', 'feta', 'mozzarella', 'chevre', 'paneer', 'parmesan', 'creme']],
  ['🥛', ['lait', 'yaourt', 'boisson', 'dessert']],
  ['🍤', ['crevette', 'calamar', 'moule']],
  ['🐟', ['saumon', 'cabillaud', 'colin', 'daurade', 'maquereau', 'thon', 'poisson']],
  ['🍗', ['poulet', 'dinde', 'volaille']],
  ['🥩', ['boeuf', 'rumsteck', 'steak', 'agneau', 'epaule', 'cotelette']],
  ['🥓', ['porc', 'lardon', 'jambon', 'saucisse', 'echine']],
  ['🍞', ['pain', 'chapelure']],
  ['🥐', ['pate feuilletee', 'pate filo']],
  ['🌾', ['farine', 'flocon', 'avoine', 'quinoa', 'boulgour', 'semoule', 'sarrasin', 'galette']],
  ['🍝', ['pate', 'spaghetti', 'tagliatelle', 'lasagne', 'nouille', 'vermicelle']],
  ['🍚', ['riz']],
  ['🫒', ['huile', 'olive']],
  ['🥫', ['bouillon', 'houmous', 'moutarde', 'mayonnaise', 'vinaigre']],
  ['🍷', ['vin']],
  ['🧂', ['sel', 'sucre', 'epice', 'cumin', 'cannelle', 'safran', 'muscade', 'garam']],
  ['🌱', ['tofu', 'graine', 'tahini', 'sesame']],
  ['💧', ['eau']],
  ['☕', ['cafe', 'the', 'tisane']],
  ['🧻', ['papier', 'eponge', 'essuie', 'lessive', 'savon']],
];

/** Pluriel simple retiré de chaque mot de plus de 3 lettres (« carottes » → « carotte »). */
const singularize = (text: string): string =>
  ` ${normalizeText(text)
    .split(' ')
    .map((w) => (w.length > 3 ? w.replace(/[sx]$/, '') : w))
    .join(' ')} `;

const COMPILED = RULES.map(([emoji, terms]) => [emoji, terms.map(singularize)] as const);

/** Emoji de l'aliment, ou `undefined` si aucun ne lui correspond. */
export function ingredientEmoji(name: string): string | undefined {
  const text = singularize(name);
  for (const [emoji, terms] of COMPILED) {
    if (terms.some((t) => text.includes(t))) return emoji;
  }
  return undefined;
}
