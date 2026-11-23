import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RatingVerdict } from '@domain/preferences';
import type { PlannedMeal } from '@domain/mealplan';
import type { Recipe } from '@domain/recipe';
import { suggestsBread, totalMinutes } from '@domain/recipe';
import type { RatingRecord } from '@domain/userdata';
import { Badge } from '../../components/Badge';
import { ButtonLink } from '../../components/Button';
import { RoundIconButton } from '../../components/RoundIconButton';
import {
  DAY_LABELS,
  LEVEL_EMOJIS,
  LEVEL_LABELS,
  SLOT_LABELS,
  formatMinutes,
} from '../../i18n/labels';
import { DishIllustration } from '../../illustrations/DishIllustration';
import { PlateGauges } from '../plate/PlateGauges';
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
 * La grande carte du repas sélectionné : illustration, nom, badges, « Pourquoi ce plat ? »,
 * jauges d'assiette et actions rondes (remplacer, 👍, 👎, voir la recette).
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

  return (
    <article
      className={styles.card}
      aria-labelledby={titleId}
      data-testid="meal"
      data-meal-id={meal.id}
    >
      <div className={styles.top}>
        <div className={styles.illustration}>
          <DishIllustration recipe={recipe} className={styles.art} />
        </div>
        <div className={styles.headline}>
          <h2 id={titleId} className={styles.title}>
            {recipe ? (
              <Link to={`/recette/${recipe.id}`} className={styles.titleLink}>
                {name}
              </Link>
            ) : (
              name
            )}
          </h2>

          {recipe && (
            <div className={styles.badges}>
              <Badge tone="primary">
                <span aria-hidden="true">{LEVEL_EMOJIS[recipe.level]}</span>
                {LEVEL_LABELS[recipe.level]}
              </Badge>
              <Badge>
                <span aria-hidden="true">⏱</span>
                {meal.isLeftover ? 'À réchauffer' : formatMinutes(totalMinutes(recipe))}
              </Badge>
              {meal.isLeftover && leftoverSource && (
                <button
                  type="button"
                  className={styles.leftoverPill}
                  onClick={() => {
                    onGoTo(leftoverSource.id);
                  }}
                >
                  <span aria-hidden="true">♻️ </span>
                  Restes du {shortMealLabel(leftoverSource)}
                </button>
              )}
              {!meal.isLeftover && feedsLeftover && (
                <button
                  type="button"
                  className={styles.leftoverPill}
                  onClick={() => {
                    onGoTo(feedsLeftover.id);
                  }}
                >
                  <span aria-hidden="true">♻️ </span>
                  Restes pour le {shortMealLabel(feedsLeftover)}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

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

      {recipe && <PlateGauges plate={recipe.plateBalance} />}

      <div className={styles.actions}>
        <RoundIconButton
          icon="🔁"
          label={`Remplacer ${name}`}
          disabled={busy}
          onClick={() => {
            onReplace(meal);
          }}
        />
        <div className={styles.rating} role="group" aria-label={`Ton avis sur ${name}`}>
          <RoundIconButton
            icon="👍"
            label="J’ai aimé"
            tone={verdict === 'up' ? 'accent' : 'plain'}
            aria-pressed={verdict === 'up'}
            disabled={busy}
            onClick={() => {
              onRate(meal, 'up');
            }}
          />
          <RoundIconButton
            icon="👎"
            label="Pas pour moi"
            tone={verdict === 'down' ? 'primary' : 'plain'}
            aria-pressed={verdict === 'down'}
            disabled={busy}
            onClick={() => {
              onRate(meal, 'down');
            }}
          />
        </div>
        {recipe && (
          <ButtonLink to={`/recette/${recipe.id}`} small className={styles.seeRecipe}>
            Voir la recette
          </ButtonLink>
        )}
      </div>
    </article>
  );
}
