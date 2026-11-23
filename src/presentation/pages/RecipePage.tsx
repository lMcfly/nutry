import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PlanView } from '@application/usecases';
import { scaleRecipeForHousehold } from '@domain/profile';
import type { Recipe } from '@domain/recipe';
import { totalMinutes } from '@domain/recipe';
import { formatIngredient, roundForRecipe } from '@domain/shopping';
import { useDependencies } from '../app/dependencies';
import { Badge } from '../components/Badge';
import { Button, ButtonLink } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Notice } from '../components/Notice';
import { Page } from '../components/Page';
import { useToast } from '../components/Toast';
import { BREAD_SUGGESTION, suggestsBread } from '../features/recipe/suggestions';
import { useAsync } from '../hooks/useAsync';
import {
  ALLERGEN_LABELS,
  DIET_LABELS,
  LEVEL_EMOJIS,
  LEVEL_HINTS,
  LEVEL_LABELS,
  PROTEIN_LABELS,
  formatMinutes,
  plural,
} from '../i18n/labels';
import styles from './RecipePage.module.css';

export const PROCESSED_PRODUCTS_NOTICE =
  'Produits transformés (jambon, pain, sauces…) : vérifie l’étiquette.';

interface RecipeData {
  readonly recipe: Recipe | undefined;
  readonly plan: PlanView | undefined;
}

export function RecipePage() {
  const { id = '' } = useParams();
  const { getCurrentPlan, getRecipe, rateMeal } = useDependencies();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (): Promise<RecipeData> => {
    const result = await getCurrentPlan();
    const plan = result.status === 'ready' ? result : undefined;
    const recipe = plan?.recipes[id] ?? (await getRecipe(id));
    return { recipe, plan };
  }, [id, getCurrentPlan, getRecipe]);

  const { state, reload } = useAsync(load);

  if (state.status !== 'ready') {
    return (
      <Page title="Recette" back={{ to: '/semaine', label: 'Ma semaine' }}>
        <p role="status">{state.status === 'loading' ? 'Un instant…' : 'Oups, réessaie.'}</p>
      </Page>
    );
  }

  const { recipe, plan } = state.data;
  if (!recipe) {
    return (
      <Page title="Recette introuvable" back={{ to: '/semaine', label: 'Ma semaine' }}>
        <EmptyState
          emoji="🔎"
          title="Cette recette n’est plus disponible"
          action={<ButtonLink to="/semaine">Retour au menu</ButtonLink>}
        >
          Elle a peut-être quitté le catalogue.
        </EmptyState>
      </Page>
    );
  }

  const householdSize = plan?.householdSize ?? 1;
  const meal = plan?.plan.meals.find((m) => m.recipeId === recipe.id && !m.isLeftover);
  const leftovers = meal ? plan?.plan.meals.filter((m) => m.leftoverOf === meal.id).length : 0;
  const batches = 1 + (leftovers ?? 0);
  const ingredients = scaleRecipeForHousehold(recipe, {
    userFactor: plan?.portionFactor ?? 1,
    householdSize,
    batches,
  });
  const liked = meal ? plan?.ratings[meal.id]?.verdict === 'up' : false;

  const addFavorite = async () => {
    if (!meal || !plan) return;
    setSaving(true);
    try {
      await rateMeal({ weekStart: plan.plan.weekStart, mealId: meal.id, verdict: 'up' });
      toast.show('Ajoutée à tes favoris 💚', 'success');
      reload();
    } finally {
      setSaving(false);
    }
  };

  const n = recipe.nutritionPerServing;

  return (
    <Page title={recipe.name} back={{ to: '/semaine', label: 'Ma semaine' }}>
      <div className={styles.badges}>
        <Badge tone="primary">
          <span aria-hidden="true">{LEVEL_EMOJIS[recipe.level]}</span>
          {LEVEL_LABELS[recipe.level]}
        </Badge>
        <Badge>
          <span aria-hidden="true">⏱</span>
          {formatMinutes(totalMinutes(recipe))}
        </Badge>
        <Badge>{PROTEIN_LABELS[recipe.mainProtein]}</Badge>
      </div>
      <p className={styles.levelHint}>
        {LEVEL_HINTS[recipe.level]} Préparation {formatMinutes(recipe.prepMinutes)}
        {recipe.cookMinutes > 0
          ? `, cuisson ${formatMinutes(recipe.cookMinutes)}`
          : ', sans cuisson'}
        .
      </p>

      {suggestsBread(recipe) && (
        <Notice tone="accent" emoji="🌾">
          {BREAD_SUGGESTION}
        </Notice>
      )}

      {meal ? (
        <Button
          variant={liked ? 'secondary' : 'primary'}
          icon={liked ? '💚' : '👍'}
          aria-pressed={liked}
          disabled={liked || saving}
          onClick={() => {
            void addFavorite();
          }}
        >
          {liked ? 'Dans tes favoris' : 'Ajouter aux favoris'}
        </Button>
      ) : null}

      <Card as="section" aria-labelledby="ingredients-title">
        <h2 id="ingredients-title">Ingrédients</h2>
        <p className={styles.servings}>
          Pour {plural(householdSize, 'personne')}
          {batches > 1 ? ', restes du lendemain compris' : ''}
        </p>
        <ul className={styles.ingredients}>
          {ingredients.map((ingredient) => {
            const q = roundForRecipe(ingredient.quantity, ingredient.unit);
            const shown = formatIngredient(ingredient.name, q.quantity, q.unit);
            return (
              <li key={`${ingredient.name}-${ingredient.unit}`}>
                <span className={styles.qty}>{shown.amount}</span>
                <span>{shown.label}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card as="section" aria-labelledby="steps-title">
        <h2 id="steps-title">Étapes</h2>
        <ol className={styles.steps}>
          {recipe.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Card>

      <Card as="section" tone="sunken" aria-labelledby="allergens-title">
        <h2 id="allergens-title">Allergènes</h2>
        <p className={styles.allergens}>
          {recipe.allergens.length === 0
            ? 'Aucun des 14 allergènes réglementaires.'
            : recipe.allergens.map((a) => ALLERGEN_LABELS[a]).join(', ')}
        </p>
        <p className={styles.small}>
          <span aria-hidden="true">🏷️ </span>
          {PROCESSED_PRODUCTS_NOTICE}
        </p>
        {recipe.diets.length > 0 && (
          <p className={styles.small}>
            Convient : {recipe.diets.map((d) => DIET_LABELS[d].toLowerCase()).join(', ')}.
          </p>
        )}
      </Card>

      <details className={styles.details}>
        <summary>Détail nutritionnel (optionnel)</summary>
        <p className={styles.small}>Par portion, à titre indicatif :</p>
        <dl className={styles.nutrition}>
          <dt>Énergie</dt>
          <dd>{n.kcal} kcal</dd>
          <dt>Protéines</dt>
          <dd>{n.proteinG.toLocaleString('fr-FR')} g</dd>
          <dt>Glucides</dt>
          <dd>{n.carbsG.toLocaleString('fr-FR')} g</dd>
          <dt>Lipides</dt>
          <dd>{n.fatG.toLocaleString('fr-FR')} g</dd>
          <dt>Fibres</dt>
          <dd>{n.fiberG.toLocaleString('fr-FR')} g</dd>
        </dl>
        <p className={styles.small}>
          Source : Anses, table Ciqual 2025 (calcul à partir des ingrédients).
        </p>
      </details>
    </Page>
  );
}
