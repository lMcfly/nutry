import { useEffect, useState } from 'react';
import type { MealAlternative } from '@application/usecases';
import type { PlannedMeal } from '@domain/mealplan';
import { totalMinutes } from '@domain/recipe';
import { useDependencies } from '../../app/dependencies';
import { Badge } from '../../components/Badge';
import { Sheet } from '../../components/Sheet';
import {
  DAY_LABELS,
  LEVEL_LABELS,
  PROTEIN_LABELS,
  SLOT_LABELS,
  formatMinutes,
} from '../../i18n/labels';
import styles from './ReplaceSheet.module.css';

interface ReplaceSheetProps {
  readonly meal: PlannedMeal | undefined;
  readonly currentName: string | undefined;
  readonly onClose: () => void;
  readonly onChoose: (meal: PlannedMeal, recipeId: string) => void;
}

/** Feuille « Remplacer » : 3 alternatives du même niveau, avec leur explication. */
export function ReplaceSheet({ meal, currentName, onClose, onChoose }: ReplaceSheetProps) {
  const { getMealAlternatives } = useDependencies();
  const [alternatives, setAlternatives] = useState<readonly MealAlternative[] | undefined>();

  useEffect(() => {
    if (!meal) return undefined;
    let active = true;
    setAlternatives(undefined);
    void getMealAlternatives(meal.id).then((list) => {
      if (active) setAlternatives(list);
    });
    return () => {
      active = false;
    };
  }, [meal, getMealAlternatives]);

  return (
    <Sheet
      open={meal !== undefined}
      onClose={onClose}
      title="Remplacer ce repas"
      description={
        meal
          ? `${DAY_LABELS[meal.dayIndex]}, ${SLOT_LABELS[meal.slot].toLowerCase()}${currentName ? ` : à la place de « ${currentName} »` : ''}`
          : undefined
      }
    >
      {alternatives === undefined ? (
        <p role="status">Je cherche des idées…</p>
      ) : alternatives.length === 0 ? (
        <p>Pas d’autre idée du même niveau pour l’instant. Essaie un « Nouveau menu ».</p>
      ) : (
        <ul className={styles.list} aria-label="Alternatives">
          {alternatives.map(({ recipe, explanation }) => (
            <li key={recipe.id}>
              <button
                type="button"
                className={styles.option}
                onClick={() => {
                  if (meal) onChoose(meal, recipe.id);
                }}
              >
                <span className={styles.name}>{recipe.name}</span>
                <span className={styles.badges}>
                  <Badge tone="primary">{LEVEL_LABELS[recipe.level]}</Badge>
                  <Badge>{formatMinutes(totalMinutes(recipe))}</Badge>
                  <Badge>{PROTEIN_LABELS[recipe.mainProtein]}</Badge>
                </span>
                <span className={styles.why}>{explanation}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
