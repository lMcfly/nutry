import type { PlannedMeal } from './mealplan.types';

/**
 * « Pourquoi ce plat ? » en une ligne chaleureuse, à partir des faits du score.
 * Ex. « De saison, saumon au menu comme tu aimes, 15 min ».
 */
export function explainMeal(meal: Pick<PlannedMeal, 'isLeftover' | 'score'>): string {
  if (meal.isLeftover) return 'Les restes d’hier soir : rien à cuisiner, juste à réchauffer.';
  const f = meal.score.facts;
  const parts: string[] = [];
  if (f.seasonMatch || f.seasonalProduce.length > 0) parts.push('de saison');
  if (f.likedTerms.length > 0) parts.push(`${joinFr(f.likedTerms)} au menu comme tu aimes`);
  if (f.ratedPositively) parts.push('tu avais aimé ce plat');
  if (f.batchFriendly) parts.push('se prépare à l’avance');
  if (parts.length === 0 && f.newProtein) parts.push('pour varier les plaisirs');
  parts.push(f.totalMinutes === 0 ? 'sans cuisson ni attente' : `${f.totalMinutes} min`);
  const sentence = parts.join(', ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** « a », « a et b », « a, b et c ». */
export function joinFr(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items.at(-1) ?? ''}`;
}
