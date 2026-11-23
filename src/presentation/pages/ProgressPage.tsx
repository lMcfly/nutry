import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlanHistory, ProgressView } from '@application/usecases';
import type { Recipe } from '@domain/recipe';
import { startOfWeek } from '@domain/shared';
import { parseDecimal } from '../features/profile/draft';
import { useDependencies } from '../app/dependencies';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { Notice } from '../components/Notice';
import { Page } from '../components/Page';
import { useToast } from '../components/Toast';
import { TrendChart } from '../features/progress/TrendChart';
import { useAsync } from '../hooks/useAsync';
import { formatDateFull, formatDayShort, formatDecimal, plural } from '../i18n/labels';
import styles from './ProgressPage.module.css';

interface ProgressData {
  readonly progress: ProgressView;
  readonly history: PlanHistory;
  readonly favorites: readonly Recipe[];
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ProgressPage() {
  const { getProgressSummary, getPlanHistory, getFavorites } = useDependencies();
  const load = useCallback(async (): Promise<ProgressData> => {
    const [progress, history, favorites] = await Promise.all([
      getProgressSummary(),
      getPlanHistory(),
      getFavorites(),
    ]);
    return { progress, history, favorites };
  }, [getProgressSummary, getPlanHistory, getFavorites]);
  const { state, reload } = useAsync(load);
  const data = state.status === 'ready' ? state.data : undefined;

  return (
    <Page title="Mes progrès" subtitle="La régularité compte plus que les chiffres.">
      {state.status === 'loading' && <p role="status">Un instant…</p>}
      {data && (
        <>
          <MeasuresSection progress={data.progress} onChange={reload} />
          <FavoritesSection favorites={data.favorites} />
          <HistorySection history={data.history} />
        </>
      )}
    </Page>
  );
}

function MeasuresSection({
  progress,
  onChange,
}: {
  readonly progress: ProgressView;
  readonly onChange: () => void;
}) {
  const { logProgress, removeProgress, setWeightTracking } = useDependencies();
  const toast = useToast();
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [message, setMessage] = useState<string | undefined>();
  const tracking = progress.weightTracking;
  const today = localToday();
  const thisWeek = startOfWeek(today);
  const alreadyThisWeek = progress.entries.find((e) => startOfWeek(e.date) === thisWeek);
  const { summary } = progress;

  const submit = async () => {
    setMessage(undefined);
    const weightKg = tracking.enabled ? parseDecimal(weight) : undefined;
    const waistCm = parseDecimal(waist);
    if (weightKg === undefined && waistCm === undefined) {
      setMessage('Indique au moins une mesure.');
      return;
    }
    const check = await logProgress({
      ...(weightKg === undefined ? {} : { weightKg }),
      ...(waistCm === undefined ? {} : { waistCm }),
    });
    if (check.status === 'created' || check.status === 'updated') {
      setWeight('');
      setWaist('');
      toast.show(
        check.status === 'created'
          ? 'C’est noté, bravo pour ta régularité !'
          : 'Mesure de la semaine mise à jour.',
        'success',
      );
      onChange();
    } else {
      setMessage(check.message);
    }
  };

  return (
    <>
      <Card as="section" tone="soft" aria-labelledby="regularity-title">
        <h2 id="regularity-title" className={styles.cardTitle}>
          <span aria-hidden="true">🌱 </span>Ta régularité
        </h2>
        <p>{summary.message}</p>
        {summary.weeksTracked > 0 && (
          <p className={styles.small}>
            {plural(summary.weeksTracked, 'semaine suivie', 'semaines suivies')}
            {summary.currentStreakWeeks > 1
              ? ` · ${summary.currentStreakWeeks} semaines d’affilée`
              : ''}
          </p>
        )}
      </Card>

      {!tracking.enabled && (
        <Card as="section" tone="sunken" aria-labelledby="tracking-title">
          <h2 id="tracking-title" className={styles.cardTitle}>
            <span aria-hidden="true">⚖️ </span>Suivi du poids
          </h2>
          <p className={styles.small}>
            {tracking.enabledByDefault
              ? 'Le suivi du poids est en pause. Tu peux le réactiver quand tu veux : une mesure par semaine au plus, pour voir une tendance, jamais pour juger.'
              : 'Pour ton profil, on préfère ne pas mettre l’accent sur le poids : l’essentiel se joue dans l’assiette et dans ton énergie. Si tu y tiens vraiment, tu peux l’activer, tout en douceur.'}
          </p>
          <Button
            variant="secondary"
            small
            onClick={() => {
              void setWeightTracking(true).then(onChange);
            }}
          >
            Activer le suivi du poids
          </Button>
        </Card>
      )}

      <Card as="section" aria-labelledby="measure-title">
        <h2 id="measure-title" className={styles.cardTitle}>
          <span aria-hidden="true">📏 </span>Ma mesure de la semaine
        </h2>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {alreadyThisWeek && (
            <Notice tone="success" emoji="✅">
              Déjà noté cette semaine ({formatDayShort(alreadyThisWeek.date)}). Une nouvelle saisie
              met à jour la mesure de la semaine.
            </Notice>
          )}
          <div className={styles.fields}>
            {tracking.enabled && (
              <Field
                label="Poids"
                inputMode="decimal"
                suffix="kg"
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value);
                }}
              />
            )}
            <Field
              label="Tour de taille"
              inputMode="decimal"
              suffix="cm"
              value={waist}
              onChange={(e) => {
                setWaist(e.target.value);
              }}
            />
          </div>
          {message && (
            <p className={styles.error} role="alert">
              {message}
            </p>
          )}
          <Button type="submit">Enregistrer</Button>
        </form>
      </Card>

      {(progress.weightTrend.length > 0 || progress.waistTrend.length > 0) && (
        <Card as="section" aria-labelledby="trend-title">
          <h2 id="trend-title" className={styles.cardTitle}>
            <span aria-hidden="true">📈 </span>Ta tendance
          </h2>
          <div className={styles.charts}>
            {progress.weightTrend.length > 0 && (
              <TrendChart title="Poids, tendance lissée" unit="kg" points={progress.weightTrend} />
            )}
            {progress.waistTrend.length > 0 && (
              <TrendChart
                title="Tour de taille, tendance lissée"
                unit="cm"
                points={progress.waistTrend}
              />
            )}
          </div>
          <details className={styles.entries}>
            <summary>Mes mesures ({progress.entries.length})</summary>
            <ul>
              {[...progress.entries].reverse().map((entry) => (
                <li key={entry.date}>
                  <span>
                    {formatDateFull(entry.date)} :{' '}
                    {[
                      entry.weightKg !== undefined ? `${formatDecimal(entry.weightKg)} kg` : '',
                      entry.waistCm !== undefined ? `${formatDecimal(entry.waistCm)} cm` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Supprimer la mesure du ${formatDateFull(entry.date)}`}
                    onClick={() => {
                      void removeProgress(entry.date).then(() => {
                        toast.show('Mesure supprimée.');
                        onChange();
                      });
                    }}
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}
    </>
  );
}

function FavoritesSection({ favorites }: { readonly favorites: readonly Recipe[] }) {
  return (
    <Card as="section" aria-labelledby="favorites-title">
      <h2 id="favorites-title" className={styles.cardTitle}>
        <span aria-hidden="true">💚 </span>Mes recettes favorites
      </h2>
      {favorites.length === 0 ? (
        <EmptyState emoji="👍" title="Pas encore de favori" level={3}>
          Un 👍 sur un plat de ton menu, et il arrive ici.
        </EmptyState>
      ) : (
        <ul className={styles.links}>
          {favorites.map((r) => (
            <li key={r.id}>
              <Link to={`/recette/${r.id}`}>{r.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function HistorySection({ history }: { readonly history: PlanHistory }) {
  return (
    <Card as="section" aria-labelledby="history-title">
      <h2 id="history-title" className={styles.cardTitle}>
        <span aria-hidden="true">📚 </span>Mes menus passés
      </h2>
      {history.plans.length === 0 ? (
        <p className={styles.small}>Ton historique se construira semaine après semaine.</p>
      ) : (
        <div className={styles.history}>
          {history.plans.map((plan) => {
            const recipes = [
              ...new Set(plan.meals.filter((m) => !m.isLeftover).map((m) => m.recipeId)),
            ]
              .map((id) => history.recipes[id])
              .filter((r): r is Recipe => r !== undefined);
            return (
              <details key={plan.weekStart} className={styles.week}>
                <summary>
                  Semaine du {formatDateFull(plan.weekStart)} · {plural(recipes.length, 'plat')}
                </summary>
                <ul className={styles.links}>
                  {recipes.map((r) => (
                    <li key={r.id}>
                      <Link to={`/recette/${r.id}`}>{r.name}</Link>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}
    </Card>
  );
}
