import { useCallback, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDependencies } from '../app/dependencies';
import { ButtonLink } from '../components/Button';
import { ArrowLeftIcon, HeartIcon, LeafIcon, SearchIcon } from '../components/icons';
import { EmptyState } from '../components/EmptyState';
import { Notice } from '../components/Notice';
import { Page } from '../components/Page';
import { RoundIconButton } from '../components/RoundIconButton';
import { ScrollArea } from '../components/ScrollArea';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { panelId, tabId } from '../components/tabIds';
import { useToast } from '../components/Toast';
import { useCelebrationCheck } from '../features/companion/Celebration';
import { PlateGauges } from '../features/plate/PlateGauges';
import { BREAD_SUGGESTION } from '../features/recipe/suggestions';
import { useAsync } from '../hooks/useAsync';
import { useRecipePhoto } from '../hooks/useRecipePhotos';
import { usePageTitle } from '../hooks/usePageTitle';
import { DishImage } from '../illustrations/DishImage';
import {
  ALLERGEN_LABELS,
  CIQUAL_CITATION,
  DIET_LABELS,
  LEVEL_HINTS,
  LEVEL_LABELS,
  PROTEIN_LABELS,
  formatMinutes,
  plural,
} from '../i18n/labels';
import styles from './RecipePage.module.css';

export const PROCESSED_PRODUCTS_NOTICE =
  'Produits transformés (jambon, pain, sauces…) : vérifie l’étiquette.';

type RecipeTab = 'ingredients' | 'etapes' | 'infos';

const RECIPE_TABS = [
  { id: 'ingredients', label: 'Ingrédients' },
  { id: 'etapes', label: 'Étapes' },
  { id: 'infos', label: 'Infos' },
] as const;

export function RecipePage() {
  const { id = '' } = useParams();
  const { getRecipeView, rateMeal } = useDependencies();
  const toast = useToast();
  const checkCelebration = useCelebrationCheck();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<RecipeTab>('ingredients');
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(() => getRecipeView(id), [id, getRecipeView]);

  const { state, reload } = useAsync(load);
  const view = state.status === 'ready' ? state.data : undefined;
  const photo = useRecipePhoto(view?.recipe.id);
  usePageTitle(view?.recipe.name ?? 'Recette', headingRef);

  if (state.status !== 'ready') {
    return (
      <Page title="Recette" back={{ to: '/semaine', label: 'Ma semaine' }}>
        <p role="status">{state.status === 'loading' ? 'Un instant…' : 'Oups, réessaie.'}</p>
      </Page>
    );
  }

  if (!view) {
    return (
      <Page title="Recette introuvable" back={{ to: '/semaine', label: 'Ma semaine' }}>
        <EmptyState
          emoji={<SearchIcon size={28} />}
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
      toast.show('Ajoutée à tes favoris.', 'success');
      checkCelebration();
      reload();
    } finally {
      setSaving(false);
    }
  };

  const n = recipe.nutritionPerServing;

  return (
    <div className={styles.recipe}>
      <div className={styles.left}>
        <div className={styles.hero}>
          <DishImage
            recipe={recipe}
            src={photo}
            alt={recipe.name}
            ratio="16 / 10"
            fill
            priority
            className={styles.heroImage}
          />
          <Link to="/semaine" className={styles.back} aria-label="Retour : Ma semaine">
            <ArrowLeftIcon />
          </Link>
          {meal && (
            <RoundIconButton
              className={styles.favorite}
              icon={<HeartIcon />}
              label={liked ? 'Dans tes favoris' : 'Ajouter aux favoris'}
              tone={liked ? 'accent' : 'plain'}
              aria-pressed={liked}
              disabled={liked || saving}
              onClick={() => {
                void addFavorite();
              }}
            />
          )}
        </div>

        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          {recipe.name}
        </h1>
        <p className={styles.meta}>
          {LEVEL_LABELS[recipe.level]}
          <span aria-hidden="true"> · </span>
          <span className="visually-hidden">, </span>
          {formatMinutes(view.totalMinutes)}
          <span aria-hidden="true"> · </span>
          <span className="visually-hidden">, </span>
          {PROTEIN_LABELS[recipe.mainProtein]}
        </p>
      </div>

      <div className={styles.right}>
        <SegmentedTabs
          idPrefix="recette"
          label="Sections de la recette"
          tabs={RECIPE_TABS}
          value={tab}
          onChange={setTab}
        />

        <div
          role="tabpanel"
          id={panelId('recette', tab)}
          aria-labelledby={tabId('recette', tab)}
          className={styles.panel}
        >
          <ScrollArea
            label={RECIPE_TABS.find((t) => t.id === tab)?.label ?? 'Recette'}
            className={styles.scroll}
          >
            {tab === 'ingredients' && (
              <section aria-labelledby="ingredients-title">
                <h2 id="ingredients-title" className="visually-hidden">
                  Ingrédients
                </h2>
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
              </section>
            )}
            {tab === 'etapes' && (
              <section aria-labelledby="steps-title">
                <h2 id="steps-title" className="visually-hidden">
                  Étapes
                </h2>
                <ol className={styles.steps}>
                  {recipe.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
            )}
            {tab === 'infos' && (
              <section aria-labelledby="allergens-title" className={styles.infos}>
                <PlateGauges plate={recipe.plateBalance} />
                <h2 id="allergens-title" className={styles.sub}>
                  Allergènes
                </h2>
                <p className={styles.allergens}>
                  {recipe.allergens.length === 0
                    ? 'Aucun des 14 allergènes réglementaires.'
                    : recipe.allergens.map((a) => ALLERGEN_LABELS[a]).join(', ')}
                </p>
                <p className={styles.small}>{PROCESSED_PRODUCTS_NOTICE}</p>
                {recipe.diets.length > 0 && (
                  <p className={styles.small}>
                    Convient : {recipe.diets.map((d) => DIET_LABELS[d].toLowerCase()).join(', ')}.
                  </p>
                )}
                <p className={styles.small}>
                  {LEVEL_HINTS[recipe.level]} Préparation {formatMinutes(recipe.prepMinutes)}
                  {recipe.cookMinutes > 0
                    ? `, cuisson ${formatMinutes(recipe.cookMinutes)}`
                    : ', sans cuisson'}
                  .
                </p>
                {view.suggestsBread && (
                  <Notice tone="accent" emoji={<LeafIcon size={20} />}>
                    {BREAD_SUGGESTION}
                  </Notice>
                )}
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
              </section>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
