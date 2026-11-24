import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FridgeSuggestion } from '@domain/fridge';
import { totalMinutes } from '@domain/recipe';
import { normalizeText } from '@domain/shared';
import { ingredientEmoji } from '@domain/shopping';
import { useDependencies } from '../app/dependencies';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { CloseIcon, FridgeIcon, SearchIcon } from '../components/icons';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { Page } from '../components/Page';
import { useAsync } from '../hooks/useAsync';
import { LEVEL_LABELS, formatMinutes } from '../i18n/labels';
import styles from './FridgePage.module.css';

/** Nombre de puces affichées sans recherche. */
const VISIBLE_CHIPS = 24;
const MAX_RESULTS = 20;

export function FridgePage() {
  const { listFridgeIngredients, suggestFromFridge } = useDependencies();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [results, setResults] = useState<readonly FridgeSuggestion[] | undefined>();

  const loadIngredients = useCallback(() => listFridgeIngredients(), [listFridgeIngredients]);
  const { state } = useAsync(loadIngredients);
  const ingredients = useMemo(() => (state.status === 'ready' ? state.data : []), [state]);

  const visible = useMemo(() => {
    const q = normalizeText(query);
    const pool = ingredients.filter((i) => !selected.includes(i));
    return q === ''
      ? pool.slice(0, VISIBLE_CHIPS)
      : pool.filter((i) => normalizeText(i).includes(q)).slice(0, VISIBLE_CHIPS);
  }, [ingredients, query, selected]);

  useEffect(() => {
    if (selected.length === 0) {
      setResults(undefined);
      return undefined;
    }
    let active = true;
    void suggestFromFridge({ available: selected, limit: MAX_RESULTS }).then((result) => {
      if (active) setResults(result.status === 'ready' ? result.suggestions : []);
    });
    return () => {
      active = false;
    };
  }, [selected, suggestFromFridge]);

  const toggle = (ingredient: string) => {
    setSelected((s) =>
      s.includes(ingredient) ? s.filter((i) => i !== ingredient) : [...s, ingredient],
    );
  };

  return (
    <Page
      narrow
      title="Frigo vide"
      subtitle="Coche ce que tu as, je te dis quoi cuisiner."
      back={{ to: '/semaine', label: 'Ma semaine' }}
      scroll
    >
      <form
        role="search"
        className={styles.search}
        onSubmit={(event) => {
          event.preventDefault();
          const first = visible[0];
          if (first) {
            toggle(first);
            setQuery('');
          }
        }}
      >
        <Field
          label="Chercher un ingrédient"
          type="search"
          placeholder="Ex. courgette, œufs, riz…"
          value={query}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
          }}
        />
      </form>

      {selected.length > 0 && (
        <section aria-labelledby="have-title" className={styles.block}>
          <div className={styles.blockHead}>
            <h2 id="have-title" className={styles.blockTitle}>
              J’ai ({selected.length})
            </h2>
            <Button
              variant="ghost"
              small
              onClick={() => {
                setSelected([]);
              }}
            >
              Tout retirer
            </Button>
          </div>
          <ul className={styles.chips}>
            {selected.map((i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`${styles.chip} ${styles.chipOn}`}
                  aria-pressed="true"
                  onClick={() => {
                    toggle(i);
                  }}
                >
                  <span aria-hidden="true">{ingredientEmoji(i) ?? '🍽️'}</span>
                  {i} <CloseIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="ingredients-title" className={styles.block}>
        <h2 id="ingredients-title" className={styles.blockTitle}>
          {query ? 'Résultats' : 'Ingrédients'}
        </h2>
        {state.status === 'loading' ? (
          <p role="status">Un instant…</p>
        ) : visible.length === 0 ? (
          <p className={styles.muted}>Aucun ingrédient ne correspond.</p>
        ) : (
          <ul className={styles.chips}>
            {visible.map((i) => (
              <li key={i}>
                <button
                  type="button"
                  className={styles.chip}
                  aria-pressed="false"
                  onClick={() => {
                    toggle(i);
                  }}
                >
                  <span aria-hidden="true">{ingredientEmoji(i) ?? '🍽️'}</span>
                  {i}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ideas-title" className={styles.block} aria-live="polite">
        <h2 id="ideas-title" className={styles.blockTitle}>
          Idées de recettes
        </h2>
        {results === undefined ? (
          <EmptyState emoji={<FridgeIcon size={28} />} title="Ton frigo, ton menu" level={3}>
            Touche au moins un ingrédient pour voir des idées.
          </EmptyState>
        ) : results.length === 0 ? (
          <EmptyState emoji={<SearchIcon size={28} />} title="Pas encore d’idée" level={3}>
            Ajoute un ou deux ingrédients de plus.
          </EmptyState>
        ) : (
          <ul className={styles.results}>
            {results.map(({ recipe, missing }) => (
              <li key={recipe.id} className={styles.result}>
                <Link to={`/recette/${recipe.id}`} state={{ recipe }} className={styles.resultLink}>
                  {recipe.name}
                </Link>
                <span className={styles.resultBadges}>
                  <Badge tone="primary">{LEVEL_LABELS[recipe.level]}</Badge>
                  <Badge>{formatMinutes(totalMinutes(recipe))}</Badge>
                  {missing.length === 0 ? (
                    <Badge tone="primary">Tu as tout !</Badge>
                  ) : (
                    <Badge tone="accent">
                      {missing.length} manquant{missing.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </span>
                {missing.length > 0 && (
                  <p className={styles.missing}>
                    Il te manque : {missing.map((m) => m.name).join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
