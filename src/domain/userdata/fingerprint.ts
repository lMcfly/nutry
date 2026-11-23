import type { WeeklyPlan } from '../mealplan';
import { isPregnancyRelevant } from '../recipe';
import type { DietaryConstraints } from '../recipe';
import { normalizeText } from '../shared';

const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort();

/**
 * Empreinte des filtres durs d'un profil (régimes, allergies, aliments détestés,
 * grossesse ou allaitement). Un menu généré avec une autre empreinte doit être
 * régénéré : il peut contenir un plat désormais exclu. Indépendante de l'ordre.
 */
export function dietaryFingerprint(constraints: DietaryConstraints): string {
  return JSON.stringify({
    d: sortedUnique(constraints.diets),
    a: sortedUnique(constraints.allergens),
    x: sortedUnique(constraints.dislikes.map(normalizeText).filter((s) => s.length > 0)),
    p: isPregnancyRelevant(constraints),
  });
}

/** Empreinte du contenu d'un menu : repas, recettes et restes. */
export function planSignature(plan: Pick<WeeklyPlan, 'meals'>): string {
  return plan.meals.map((m) => `${m.id}=${m.recipeId}${m.isLeftover ? '*' : ''}`).join('|');
}

/**
 * Base de la liste de courses : menu, taille du foyer et facteur de portion. Si elle
 * change, les quantités changent et les cases cochées ne veulent plus rien dire.
 */
export function shoppingBasisKey(input: {
  readonly plan: Pick<WeeklyPlan, 'meals'>;
  readonly householdSize: number;
  readonly portionFactor: number;
}): string {
  return `${planSignature(input.plan)}#${input.householdSize}#${input.portionFactor.toFixed(3)}`;
}
