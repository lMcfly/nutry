import { normalizeText } from '../shared';
import type { PlannedMeal } from './mealplan.types';

/**
 * Aliment aimé avec son article (« de la tomate », « du saumon »), pour une phrase
 * naturelle. Clés : termes des puces de préférence, normalisés (sans accents).
 */
const WITH_ARTICLE: Readonly<Record<string, string>> = {
  viande: 'de la viande',
  volaille: 'de la volaille',
  porc: 'du porc',
  boeuf: 'du bœuf',
  poisson: 'du poisson',
  saumon: 'du saumon',
  'fruits de mer': 'des fruits de mer',
  oeufs: 'des œufs',
  fromage: 'du fromage',
  tofu: 'du tofu',
  legumineuses: 'des légumineuses',
  champignons: 'des champignons',
  poivron: 'du poivron',
  tomate: 'de la tomate',
  courgette: 'de la courgette',
  brocoli: 'du brocoli',
  epinards: 'des épinards',
  avocat: 'de l’avocat',
  coriandre: 'de la coriandre',
  olives: 'des olives',
  riz: 'du riz',
  pates: 'des pâtes',
  'pomme de terre': 'de la pomme de terre',
};

/** Terme « aimé » qui n'est pas un aliment mais un style. */
const SPICY = 'epice';

/** « avec de la tomate et du saumon, que tu aimes » ; « épicé, comme tu aimes ». */
function likedPhrase(terms: readonly string[]): string | undefined {
  const spicy = terms.some((t) => normalizeText(t) === SPICY);
  const foods = terms
    .filter((t) => normalizeText(t) !== SPICY)
    .map((t) => WITH_ARTICLE[normalizeText(t)] ?? t);
  if (foods.length === 0) return spicy ? 'épicé, comme tu aimes' : undefined;
  return `avec ${joinFr(foods)}, que tu aimes${spicy ? ', et épicé' : ''}`;
}

/**
 * « Pourquoi ce plat ? » en une ligne, à partir des faits du score. Les raisons sont
 * séparées par « · » pour rester lisibles sur mobile.
 * Ex. « Avec du saumon, que tu aimes · poireaux de saison · prêt en 25 min ».
 */
export function explainMeal(meal: Pick<PlannedMeal, 'isLeftover' | 'score'>): string {
  if (meal.isLeftover) return 'Les restes d’hier soir : rien à cuisiner, juste à réchauffer.';
  const f = meal.score.facts;
  const parts: string[] = [];
  const liked = likedPhrase(f.likedTerms);
  if (liked) parts.push(liked);
  if (f.ratedPositively) parts.push('tu avais aimé ce plat');
  if (f.seasonalProduce.length > 0) {
    parts.push(`${joinFr(f.seasonalProduce.slice(0, 2))} de saison`);
  } else if (f.seasonMatch) {
    parts.push('un plat de saison');
  }
  if (f.batchFriendly) parts.push('se prépare à l’avance');
  if (parts.length === 0 && f.newProtein) parts.push('pour varier les plaisirs');
  parts.push(f.totalMinutes === 0 ? 'sans cuisson' : `prêt en ${f.totalMinutes} min`);
  const sentence = parts.join(' · ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** « a », « a et b », « a, b et c ». */
export function joinFr(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items.at(-1) ?? ''}`;
}
