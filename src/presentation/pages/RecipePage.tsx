import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDependencies } from '../app/dependencies';
import { Badge } from '../components/Badge';
import { Button, ButtonLink } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Notice } from '../components/Notice';
import { Page } from '../components/Page';
import { useToast } from '../components/Toast';
import { BREAD_SUGGESTION } from '../features/recipe/suggestions';
import { useAsync } from '../hooks/useAsync';
import {
  ALLERGEN_LABELS,
  CIQUAL_CITATION,
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

export function RecipePage() {
  const { id = '' } = useParams();
  const { getRecipeView, rateMeal } = useDependencies();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => getRecipeView(id), [id, getRecipeView]);

  const { state, reload } = useAsync(load);

  if (state.status !== 'ready') {
    return (
      <Page title="Recette" back={{ to: '/semaine', label: 'Ma semaine' }}>
        <p role="status">{state.status === 'loading' ? 'Un instant…' : 'Oups, réessaie.'}</p>
      </Page>
    );
  }

  const view = state.data;
  if (!view) {
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

  const { recipe, meal } = view;
  const liked = meal?.liked ?? false;

  const addFavorite = async () => {
    if (!meal) return;
    setSaving(true);
    try {
      await rateMeal({ weekStart: meal.weekStart, mealId: meal.mealId, verdict: 'up' });
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
          {formatMinutes(view.totalMinutes)}
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

      {view.suggestsBread && (
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
          Pour {plural(view.householdSize, 'personne')}
          {view.batches > 1 ? ', restes du lendemain compris' : ''}
        </p>
        <ul className={styles.ingredients}>
          {view.ingredients.map((line) => (
            <li key={line.key}>
              <span className={styles.qty}>{line.amount}</span>
              <span>{line.label}</span>
            </li>
          ))}
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
          Source : « {CIQUAL_CITATION} » (calcul à partir des ingrédients).
        </p>
      </details>
    </Page>
  );
}
