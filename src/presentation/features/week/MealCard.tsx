import { useId } from 'react';
import { Link } from 'react-router-dom';
import { RATING_REASONS } from '@domain/preferences';
import type { RatingReason, RatingVerdict } from '@domain/preferences';
import type { PlannedMeal } from '@domain/mealplan';
import type { Recipe } from '@domain/recipe';
import { totalMinutes } from '@domain/recipe';
import type { RatingRecord } from '@domain/userdata';
import { Badge } from '../../components/Badge';
import { RadioGroup } from '../../components/Choice';
import {
  DAY_LABELS,
  LEVEL_EMOJIS,
  LEVEL_LABELS,
  RATING_REASON_LABELS,
  SLOT_EMOJIS,
  SLOT_LABELS,
  formatMinutes,
} from '../../i18n/labels';
import { BREAD_SUGGESTION, suggestsBread } from '../recipe/suggestions';
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
  readonly onReason: (meal: PlannedMeal, reason: RatingReason) => void;
}

function mealAnchorId(mealId: string): string {
  return `repas-${mealId}`;
}

function focusMeal(mealId: string) {
  const target = document.getElementById(mealAnchorId(mealId));
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.focus({ preventScroll: true });
}

/** « dîner de lundi ». */
function shortMealLabel(meal: PlannedMeal): string {
  return `${SLOT_LABELS[meal.slot].toLowerCase()} de ${DAY_LABELS[meal.dayIndex].toLowerCase()}`;
}

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
  onReason,
}: MealCardProps) {
  const titleId = useId();
  const verdict = rating?.verdict;
  const name = recipe?.name ?? 'Recette indisponible';

  return (
    <article
      id={mealAnchorId(meal.id)}
      className={`${styles.card} ${meal.isLeftover ? styles.leftover : ''}`}
      aria-labelledby={titleId}
      tabIndex={-1}
      data-testid="meal"
    >
      <div className={styles.meta}>
        <span className={styles.slot}>
          <span aria-hidden="true">{SLOT_EMOJIS[meal.slot]} </span>
          {SLOT_LABELS[meal.slot]}
        </span>
        {recipe && (
          <span className={styles.badges}>
            <Badge tone="primary">
              <span aria-hidden="true">{LEVEL_EMOJIS[recipe.level]}</span>
              {LEVEL_LABELS[recipe.level]}
            </Badge>
            <Badge>
              <span aria-hidden="true">⏱</span>
              {meal.isLeftover ? 'À réchauffer' : formatMinutes(totalMinutes(recipe))}
            </Badge>
          </span>
        )}
      </div>

      <h3 id={titleId} className={styles.title}>
        {recipe ? (
          <Link to={`/recette/${recipe.id}`} className={styles.titleLink}>
            {name}
          </Link>
        ) : (
          name
        )}
      </h3>

      {meal.isLeftover && leftoverSource && (
        <button
          type="button"
          className={styles.leftoverPill}
          onClick={() => {
            focusMeal(leftoverSource.id);
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
            focusMeal(feedsLeftover.id);
          }}
        >
          <span aria-hidden="true">♻️ </span>
          Cuisine double : restes pour {shortMealLabel(feedsLeftover)}
        </button>
      )}

      {recipe && suggestsBread(recipe) && <p className={styles.bread}>{BREAD_SUGGESTION}</p>}

      {explanation !== undefined && (
        <p className={styles.why}>
          <span className={styles.whyLabel}>Pourquoi ce plat ?</span> {explanation}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.action}
          disabled={busy}
          onClick={() => {
            onReplace(meal);
          }}
        >
          <span aria-hidden="true">🔁</span>
          <span>
            Remplacer<span className="visually-hidden"> {name}</span>
          </span>
        </button>
        <div className={styles.rating} role="group" aria-label={`Ton avis sur ${name}`}>
          <button
            type="button"
            className={`${styles.thumb} ${verdict === 'up' ? styles.thumbOn : ''}`}
            aria-pressed={verdict === 'up'}
            aria-label="J’ai aimé"
            disabled={busy}
            onClick={() => {
              onRate(meal, 'up');
            }}
          >
            👍
          </button>
          <button
            type="button"
            className={`${styles.thumb} ${verdict === 'down' ? styles.thumbOff : ''}`}
            aria-pressed={verdict === 'down'}
            aria-label="Pas pour moi"
            disabled={busy}
            onClick={() => {
              onRate(meal, 'down');
            }}
          >
            👎
          </button>
        </div>
      </div>

      {verdict === 'down' && (
        <div className={styles.reasons}>
          <RadioGroup
            legend="Une raison ? (facultatif)"
            options={RATING_REASONS.map((r) => ({ value: r, label: RATING_REASON_LABELS[r] }))}
            value={rating?.reason}
            onChange={(reason) => {
              onReason(meal, reason);
            }}
          />
        </div>
      )}
    </article>
  );
}
