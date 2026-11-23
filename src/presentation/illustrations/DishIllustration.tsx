import { DishDrawing } from './dishes';
import { pickDishFamily } from './match';
import type { DishFamily, DishSubject } from './match';

interface DishIllustrationProps {
  /** Recette à illustrer (famille choisie d'après son nom, ses étiquettes et sa protéine). */
  readonly recipe?: DishSubject | undefined;
  /** Famille imposée (tests, aperçus). */
  readonly family?: DishFamily | undefined;
  readonly className?: string | undefined;
}

/**
 * Illustration plate du plat. Décorative (`aria-hidden`) : le nom du plat est toujours
 * affiché à côté. S'adapte à la hauteur de son conteneur (`height: 100%`).
 */
export function DishIllustration({ recipe, family, className }: DishIllustrationProps) {
  const chosen: DishFamily = family ?? (recipe ? pickDishFamily(recipe) : 'bowl');
  return (
    <svg
      viewBox="0 0 200 140"
      className={className}
      aria-hidden="true"
      focusable="false"
      data-family={chosen}
      preserveAspectRatio="xMidYMid meet"
    >
      <DishDrawing family={chosen} />
    </svg>
  );
}
