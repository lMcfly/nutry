import { ceilTo, roundTo } from '../shared';
import type { Unit } from '../recipe';

/** Unités converties vers une unité de base pour pouvoir fusionner (kg → g, cl / l → ml). */
const BASE_UNIT: Partial<Record<Unit, { unit: Unit; factor: number }>> = {
  kg: { unit: 'g', factor: 1000 },
  cl: { unit: 'ml', factor: 10 },
  l: { unit: 'ml', factor: 1000 },
};

export function toBaseUnit(quantity: number, unit: Unit): { quantity: number; unit: Unit } {
  const base = BASE_UNIT[unit];
  return base ? { quantity: quantity * base.factor, unit: base.unit } : { quantity, unit };
}

/** g / ml au multiple de 5 (≥ 5), repassés en kg / l à partir de 1 000. */
function roundMass(base: { quantity: number; unit: Unit }): { quantity: number; unit: Unit } {
  const rounded = Math.max(5, ceilTo(base.quantity, 5));
  if (rounded >= 1000) {
    return { quantity: ceilTo(rounded / 1000, 0.05), unit: base.unit === 'g' ? 'kg' : 'l' };
  }
  return { quantity: rounded, unit: base.unit };
}

const ceilWhole = (q: number): number => Math.max(1, Math.ceil(q - 1e-9));
const ceilHalf = (q: number): number => Math.max(0.5, ceilTo(q, 0.5));

/**
 * Arrondi « achetable » (liste de courses) : g et ml au multiple de 5 supérieur (≥ 5)
 * puis repassés en kg / l à partir de 1 000 ; ce qui s'achète entier (pièces, gousses,
 * boîtes, bottes) à l'unité supérieure ; tranches et cuillères à la demi-unité
 * supérieure ; pincées à l'unité.
 */
export function roundForShopping(quantity: number, unit: Unit): { quantity: number; unit: Unit } {
  const base = toBaseUnit(quantity, unit);
  switch (base.unit) {
    case 'g':
    case 'ml':
      return roundMass(base);
    case 'boite':
    case 'botte':
    case 'piece':
    case 'gousse':
      return { quantity: ceilWhole(base.quantity), unit: base.unit };
    case 'pincee':
      return { quantity: Math.max(1, Math.round(base.quantity)), unit: base.unit };
    default:
      return { quantity: ceilHalf(base.quantity), unit: base.unit };
  }
}

/**
 * Arrondi pour lire une recette : on garde les demi-unités (« 1,5 concombre »), sauf
 * les gousses à partir de 2, arrondies à l'entier supérieur (« 7 gousses »).
 */
export function roundForRecipe(quantity: number, unit: Unit): { quantity: number; unit: Unit } {
  const base = toBaseUnit(quantity, unit);
  switch (base.unit) {
    case 'g':
    case 'ml':
      return roundMass(base);
    case 'boite':
    case 'botte':
      return { quantity: ceilHalf(base.quantity), unit: base.unit };
    case 'gousse':
      return {
        quantity: base.quantity >= 2 ? Math.ceil(base.quantity - 1e-9) : ceilHalf(base.quantity),
        unit: base.unit,
      };
    case 'pincee':
      return { quantity: Math.max(1, Math.round(base.quantity)), unit: base.unit };
    default:
      return { quantity: ceilHalf(base.quantity), unit: base.unit };
  }
}

const UNIT_LABELS: Readonly<Record<Unit, readonly [string, string]>> = {
  g: ['g', 'g'],
  kg: ['kg', 'kg'],
  ml: ['ml', 'ml'],
  cl: ['cl', 'cl'],
  l: ['l', 'l'],
  piece: ['', ''],
  'cuillere-soupe': ['c. à soupe', 'c. à soupe'],
  'cuillere-cafe': ['c. à café', 'c. à café'],
  pincee: ['pincée', 'pincées'],
  gousse: ['gousse', 'gousses'],
  botte: ['botte', 'bottes'],
  tranche: ['tranche', 'tranches'],
  boite: ['boîte', 'boîtes'],
};

/** Nombre à la française (virgule décimale, 2 décimales au plus). */
export function formatNumberFr(value: number): string {
  return String(roundTo(value, 0.01)).replace('.', ',');
}

/** « 300 g », « 1,5 kg », « 2 gousses », « 3 » (pièces). */
export function formatQuantity(quantity: number, unit: Unit): string {
  const [singular, plural] = UNIT_LABELS[unit];
  // Pluriel à partir de 2 : « 1,5 gousse », « 2 gousses ».
  const label = quantity >= 2 ? plural : singular;
  const number = formatNumberFr(quantity);
  return label === '' ? number : `${number} ${label}`;
}

/** Mots qui ne prennent pas la marque du pluriel. */
const INVARIABLE_WORDS = new Set(['nature', 'pak', 'choï', 'bio']);
/** Début du complément (« pommes DE terre », « côtelettes D’agneau ») : on n'accorde pas après. */
const COMPLEMENT_WORDS = new Set(['de', 'du', 'des', 'au', 'aux', 'à', 'en']);

function pluralWord(word: string): string {
  if (INVARIABLE_WORDS.has(word.toLowerCase()) || /[sxz]$/i.test(word)) return word;
  if (/(eau|au|eu)$/i.test(word)) return `${word}x`;
  return `${word}s`;
}

/**
 * Pluriel simple d'un nom d'ingrédient (« concombre » → « concombres », « oignon rouge »
 * → « oignons rouges », « pomme de terre » → « pommes de terre »). `undefined` si ce
 * n'est pas raisonnable (chiffres, symboles…).
 */
export function pluralizeFr(name: string): string | undefined {
  const words = name.trim().split(/\s+/);
  if (words.length === 0 || words.some((w) => !/^[\p{L}’'-]+$/u.test(w))) return undefined;
  let inComplement = false;
  return words
    .map((word) => {
      if (COMPLEMENT_WORDS.has(word.toLowerCase()) || /^d['’]/i.test(word)) inComplement = true;
      return inComplement ? word : pluralWord(word);
    })
    .join(' ');
}

/** Quantité et libellé d'une ligne : jamais un nombre nu. */
export interface IngredientDisplay {
  /** « 300 g », « 7 gousses », « 2 » (pièces, libellé au pluriel), « × 1,5 ». */
  readonly amount: string;
  /** Nom de l'ingrédient, au pluriel si compté à la pièce (≥ 2). */
  readonly label: string;
  /** Vrai si la quantité se lit avant le nom (« 2 concombres »). */
  readonly amountFirst: boolean;
}

export function formatIngredient(name: string, quantity: number, unit: Unit): IngredientDisplay {
  if (unit !== 'piece') {
    return { amount: formatQuantity(quantity, unit), label: name, amountFirst: false };
  }
  const label = quantity >= 2 ? pluralizeFr(name) : name;
  return label === undefined
    ? { amount: `× ${formatNumberFr(quantity)}`, label: name, amountFirst: false }
    : { amount: formatNumberFr(quantity), label, amountFirst: true };
}

/** Une ligne en texte : « 2 concombres », « ail : 7 gousses », « steaks hachés 5 % × 2 ». */
export function formatIngredientText(name: string, quantity: number, unit: Unit): string {
  const d = formatIngredient(name, quantity, unit);
  if (d.amountFirst) return `${d.amount} ${d.label}`;
  return unit === 'piece' ? `${d.label} ${d.amount}` : `${d.label} : ${d.amount}`;
}
