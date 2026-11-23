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

/**
 * Arrondi « achetable » : g et ml au multiple de 5 supérieur (≥ 5) puis repassés en kg / l
 * à partir de 1 000 ; boîtes et bottes à l'unité supérieure ; pièces, gousses, tranches et
 * cuillères à la demi-unité supérieure ; pincées à l'unité.
 */
export function roundForShopping(quantity: number, unit: Unit): { quantity: number; unit: Unit } {
  const base = toBaseUnit(quantity, unit);
  switch (base.unit) {
    case 'g':
    case 'ml': {
      const rounded = Math.max(5, ceilTo(base.quantity, 5));
      if (rounded >= 1000) {
        return { quantity: ceilTo(rounded / 1000, 0.05), unit: base.unit === 'g' ? 'kg' : 'l' };
      }
      return { quantity: rounded, unit: base.unit };
    }
    case 'boite':
    case 'botte':
      return { quantity: Math.max(1, Math.ceil(base.quantity - 1e-9)), unit: base.unit };
    case 'pincee':
      return { quantity: Math.max(1, Math.round(base.quantity)), unit: base.unit };
    default:
      return { quantity: Math.max(0.5, ceilTo(base.quantity, 0.5)), unit: base.unit };
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
  const label = quantity > 1 ? plural : singular;
  const number = formatNumberFr(quantity);
  return label === '' ? number : `${number} ${label}`;
}
