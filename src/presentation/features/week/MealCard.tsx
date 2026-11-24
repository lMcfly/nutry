import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RatingVerdict } from '@domain/preferences';
import type { PlannedMeal } from '@domain/mealplan';
import type { Recipe } from '@domain/recipe';
import { suggestsBread, totalMinutes } from '@domain/recipe';
import type { RatingRecord } from '@domain/userdata';
import { RecycleIcon, SwapIcon, ThumbDownIcon, ThumbUpIcon } from '../../components/icons';
import { RoundIconButton } from '../../components/RoundIconButton';
import { DAY_LABELS, LEVEL_LABELS, SLOT_LABELS, formatMinutes } from '../../i18n/labels';
import { useRecipePhoto } from '../../hooks/useRecipePhotos';
import { DishImage } from '../../illustrations/DishImage';
import { BREAD_SUGGESTION } from '../recipe/suggestions';
import styles from './MealCard.module.css';

interface MealCardProps {
  readonly meal: PlannedMeal;
  readonly recipe: Recipe | undefined;
  readonly explanation: string | undefined;
  readonly rating: RatingRecord | undefined;
  /** Repas source des restes (pour le lien visuel). */
  readonly leftoverSource: PlannedMeal | undefined;
  /** Repas de restes alimenté par ce plat. */
  readonly feedsLeftover: PlannedMeal | undefined;
  readonly busy: boolean;
  readonly onReplace: (meal: PlannedMeal) => void;
  readonly onRate: (meal: PlannedMeal, verdict: RatingVerdict) => void;
  /** Va au repas lié (restes). */
  readonly onGoTo: (mealId: string) => void;
}

/** « dîner de lundi ». */
function shortMealLabel(meal: PlannedMeal): string {
  return `${SLOT_LABELS[meal.slot].toLowerCase()} de ${DAY_LABELS[meal.dayIndex].toLowerCase()}`;
}

/**
 * La carte du repas sélectionné : illustration, nom, une ligne de méta, « Pourquoi ce plat ? »
 * et trois petites actions au trait (j'ai aimé, pas pour moi, remplacer). Toute la carte est un
 * lien vers la recette (lien étiré sur le nom) ; les jauges d'assiette sont dans la recette.
 */
export function MealCard({
  meal,
  recipe,
  explanation,
  rating,
  leftoverSource,
  feedsLeftover,
  busy,
  onReplace,
  onRate,
  onGoTo,
}: MealCardProps) {
  const titleId = useId();
  const [whyOpen, setWhyOpen] = useState(false);
  const verdict = rating?.verdict;
  const name = recipe?.name ?? 'Recette indisponible';
  const photo = useRecipePhoto(recipe?.id);

  return (
    <article
      className={styles.card}
      aria-labelledby={titleId}
      data-testid="meal"
      data-meal-id={meal.id}
    >
      <DishImage
        recipe={recipe}
        src={photo}
        alt={name}
        ratio="4 / 3"
        priority
        className={styles.art}
      />

      <div className={styles.text}>
        <h2 id={titleId} className={styles.title}>
          {recipe ? (
            <Link
              to={`/recette/${recipe.id}`}
              className={styles.titleLink}
              aria-label={`Voir la recette : ${name}`}
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </h2>

        {recipe && (
          <p className={styles.meta}>
            {LEVEL_LABELS[recipe.level]}
            <span aria-hidden="true"> · </span>
            <span className="visually-hidden">, </span>
            {meal.isLeftover ? 'À réchauffer' : formatMinutes(totalMinutes(recipe))}
          </p>
        )}

        {recipe && meal.isLeftover && leftoverSource && (
          <button
            type="button"
            className={styles.leftover}
            onClick={() => {
              onGoTo(leftoverSource.id);
            }}
          >
            <RecycleIcon size={16} />
            Restes du {shortMealLabel(leftoverSource)}
          </button>
        )}
        {recipe && !meal.isLeftover && feedsLeftover && (
          <button
            type="button"
            className={styles.leftover}
            onClick={() => {
              onGoTo(feedsLeftover.id);
            }}
          >
            <RecycleIcon size={16} />
            Restes pour le {shortMealLabel(feedsLeftover)}
          </button>
        )}

        {recipe && suggestsBread(recipe) && <p className={styles.bread}>{BREAD_SUGGESTION}</p>}

        {explanation !== undefined && (
          <button
            type="button"
            className={styles.why}
            aria-expanded={whyOpen}
            onClick={() => {
              setWhyOpen((open) => !open);
            }}
          >
            <span className={whyOpen ? undefined : styles.clamp}>
              <span className={styles.whyLabel}>Pourquoi ce plat ?</span> {explanation}
            </span>
          </button>
        )}

        <div className={styles.actions}>
          <div className={styles.rating} role="group" aria-label={`Ton avis sur ${name}`}>
            <RoundIconButton
              icon={<ThumbUpIcon />}
              label="J’ai aimé"
              tone={verdict === 'up' ? 'accent' : 'plain'}
              aria-pressed={verdict === 'up'}
              disabled={busy}
              onClick={() => {
                onRate(meal, 'up');
              }}
            />
            <RoundIconButton
              icon={<ThumbDownIcon />}
              label="Pas pour moi"
              tone={verdict === 'down' ? 'accent' : 'plain'}
              aria-pressed={verdict === 'down'}
              disabled={busy}
              onClick={() => {
                onRate(meal, 'down');
              }}
            />
          </div>
          <RoundIconButton
            icon={<SwapIcon />}
            label={`Remplacer ${name}`}
            disabled={busy}
            onClick={() => {
              onReplace(meal);
            }}
          />
        </div>
      </div>
    </article>
  );
}
