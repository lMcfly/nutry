import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlanHistory, ProgressView } from '@application/usecases';
import type { BalanceGauge } from '@domain/mealplan';
import type { Recipe } from '@domain/recipe';
import { parseDecimal } from '../profile/draft';
import { useDependencies } from '../../app/dependencies';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Field } from '../../components/Field';
import { Gauge } from '../../components/Gauge';
import { Notice } from '../../components/Notice';
import { Sheet } from '../../components/Sheet';
import {
  CalendarIcon,
  InfoIcon,
  ScaleIcon,
  TrashIcon,
  TrendIcon,
  ThumbUpIcon,
} from '../../components/icons';
import { useToast } from '../../components/Toast';
import { BALANCE_EMOJIS, BALANCE_TONES } from '../plate/balanceTones';
import { TrendChart } from './TrendChart';
import { useAsync } from '../../hooks/useAsync';
import { formatDateFull, formatDayShort, formatDecimal, plural } from '../../i18n/labels';
import styles from './ProgressCards.module.css';

interface ProgressData {
  readonly progress: ProgressView;
  readonly history: PlanHistory;
  readonly favorites: readonly Recipe[];
  readonly balance: readonly BalanceGauge[];
}

type SheetId = 'mesure' | 'favoris' | 'historique' | 'equilibre';

/** Rangées de pastilles « 3 sur 4 » : le chiffre exact se lit dans l'étiquette, pas à l'écran. */
function Dots({ count, target }: { readonly count: number; readonly target: number }) {
  const total = Math.max(1, Math.min(target, 7));
  const filled = Math.min(count, total);
  return (
    <span className={styles.dots} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? styles.dotOn : styles.dot} />
      ))}
    </span>
  );
}

/**
 * Les progrès de l'onglet « Moi », en cartes visuelles : équilibre de la semaine (pastilles
 * par famille), favoris, menus passés, mesures. Aucun pourcentage. Les détails s'ouvrent
 * dans des feuilles.
 */
export function ProgressCards() {
  const { getProgressSummary, getPlanHistory, getFavorites, getWeekBalance, setWeightTracking } =
    useDependencies();
  const load = useCallback(async (): Promise<ProgressData> => {
    const [progress, history, favorites, balance] = await Promise.all([
      getProgressSummary(),
      getPlanHistory(),
      getFavorites(),
      getWeekBalance(),
    ]);
    return { progress, history, favorites, balance };
  }, [getProgressSummary, getPlanHistory, getFavorites, getWeekBalance]);
  const { state, reload } = useAsync(load);
  const data = state.status === 'ready' ? state.data : undefined;
  const [sheet, setSheet] = useState<SheetId | undefined>();

  const progress = data?.progress;
  const tracking = progress?.weightTracking;
  const trend =
    progress && tracking?.enabled && progress.weightTrend.length > 0
      ? { title: 'Poids, tendance lissée', unit: 'kg', points: progress.weightTrend }
      : progress && progress.waistTrend.length > 0
        ? { title: 'Tour de taille, tendance lissée', unit: 'cm', points: progress.waistTrend }
        : undefined;

  return (
    <>
      {state.status === 'loading' && <p role="status">Un instant…</p>}
      {state.status === 'error' && (
        <Notice
          tone="danger"
          emoji={<InfoIcon size={20} />}
          title="Tes progrès n’ont pas pu se charger"
        >
          <Button small variant="secondary" onClick={reload}>
            Réessayer
          </Button>
        </Notice>
      )}
      {data && progress && tracking && (
        <>
          <div className={styles.cards}>
            <button
              type="button"
              className={`${styles.card} ${styles.balanceCard}`}
              onClick={() => {
                setSheet('equilibre');
              }}
            >
              <span className={styles.cardTitle}>
                <CalendarIcon size={18} />
                L’équilibre de ta semaine
              </span>
              <span className={styles.balanceRows}>
                {data.balance.map((g) => (
                  <span
                    key={g.key}
                    className={styles.balanceRow}
                    role="img"
                    aria-label={`${g.label} : ${g.count} sur ${g.target}`}
                  >
                    <span aria-hidden="true">{BALANCE_EMOJIS[g.key]}</span>
                    <Dots count={g.count} target={g.target} />
                  </span>
                ))}
              </span>
            </button>

            <button
              type="button"
              className={styles.card}
              onClick={() => {
                setSheet('favoris');
              }}
            >
              <span className={styles.bigEmoji} aria-hidden="true">
                ❤️
              </span>
              <span className={styles.cardTitle}>Favoris</span>
              <span className={styles.cardHint}>{plural(data.favorites.length, 'recette')}</span>
            </button>

            <button
              type="button"
              className={styles.card}
              onClick={() => {
                setSheet('historique');
              }}
            >
              <span className={styles.bigEmoji} aria-hidden="true">
                📖
              </span>
              <span className={styles.cardTitle}>Historique</span>
              <span className={styles.cardHint}>
                {plural(data.history.plans.length, 'menu passé', 'menus passés')}
              </span>
            </button>

            <section
              className={`${styles.card} ${styles.measureCard}`}
              aria-labelledby="weight-title"
            >
              <div className={styles.tileHead}>
                <h2 id="weight-title" className={styles.cardTitle}>
                  {tracking.enabled ? <TrendIcon size={18} /> : <ScaleIcon size={18} />}
                  {tracking.enabled ? 'Ta tendance' : 'Suivi du poids'}
                </h2>
                <Button
                  small
                  variant="ghost"
                  onClick={() => {
                    setSheet('mesure');
                  }}
                >
                  Noter ma mesure
                </Button>
              </div>
              {tracking.enabled ? (
                trend ? (
                  <TrendChart {...trend} compact />
                ) : (
                  <p className={styles.small}>Ta courbe apparaîtra après ta première mesure.</p>
                )
              ) : (
                <>
                  <p className={styles.small}>
                    {tracking.enabledByDefault
                      ? 'Le suivi du poids est en pause. Tu peux le réactiver quand tu veux : une mesure par semaine au plus, pour voir une tendance, jamais pour juger.'
                      : 'Ici, on mise sur le plaisir de manger varié et sur ton énergie, sans suivre le poids. Si tu as envie de le suivre, tu peux l’activer quand tu veux : une mesure par semaine au plus.'}
                  </p>
                  <div className={styles.tileActions}>
                    <Button
                      small
                      variant="ghost"
                      onClick={() => {
                        void setWeightTracking(true).then(reload);
                      }}
                    >
                      Activer le suivi du poids
                    </Button>
                  </div>
                </>
              )}
            </section>
          </div>

          <Sheet
            open={sheet === 'equilibre'}
            title="L’équilibre de ta semaine"
            description="De la variété, sans rien compter."
            onClose={() => {
              setSheet(undefined);
            }}
          >
            <div className={styles.gauges}>
              {data.balance.map((g) => (
                <Gauge
                  key={g.key}
                  label={g.label}
                  count={g.count}
                  target={g.target}
                  tone={BALANCE_TONES[g.key]}
                />
              ))}
            </div>
          </Sheet>

          <Sheet
            open={sheet === 'mesure'}
            title="Ma mesure de la semaine"
            onClose={() => {
              setSheet(undefined);
            }}
          >
            <MeasureForm
              progress={progress}
              onChange={reload}
              onDone={() => {
                setSheet(undefined);
              }}
            />
          </Sheet>
          <Sheet
            open={sheet === 'favoris'}
            title="Mes recettes favorites"
            onClose={() => {
              setSheet(undefined);
            }}
          >
            <FavoritesList favorites={data.favorites} />
          </Sheet>
          <Sheet
            open={sheet === 'historique'}
            title="Mes menus passés"
            onClose={() => {
              setSheet(undefined);
            }}
          >
            <HistoryList history={data.history} />
          </Sheet>
        </>
      )}
    </>
  );
}

function MeasureForm({
  progress,
  onChange,
  onDone,
}: {
  readonly progress: ProgressView;
  readonly onChange: () => void;
  readonly onDone: () => void;
}) {
  const { logProgress, removeProgress } = useDependencies();
  const toast = useToast();
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [message, setMessage] = useState<string | undefined>();
  const tracking = progress.weightTracking;
  const alreadyThisWeek = progress.thisWeekEntry;

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
      onDone();
    } else {
      setMessage(check.message);
    }
  };

  return (
    <div className={styles.measure}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {alreadyThisWeek && (
          <Notice tone="success" emoji={<InfoIcon size={20} />}>
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

      {progress.entries.length > 0 && (
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
                  <TrashIcon size={20} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function FavoritesList({ favorites }: { readonly favorites: readonly Recipe[] }) {
  return favorites.length === 0 ? (
    <EmptyState emoji={<ThumbUpIcon size={28} />} title="Pas encore de favori" level={3}>
      Un « j’ai aimé » sur un plat de ton menu, et il arrive ici.
    </EmptyState>
  ) : (
    <ul className={styles.recipeLinks}>
      {favorites.map((r) => (
        <li key={r.id}>
          <Link to={`/recette/${r.id}`}>{r.name}</Link>
        </li>
      ))}
    </ul>
  );
}

function HistoryList({ history }: { readonly history: PlanHistory }) {
  return history.plans.length === 0 ? (
    <p className={styles.small}>Ton historique se construira semaine après semaine.</p>
  ) : (
    <div className={styles.history}>
      {history.plans.map((plan) => {
        const recipes = [...new Set(plan.meals.filter((m) => !m.isLeftover).map((m) => m.recipeId))]
          .map((id) => history.recipes[id])
          .filter((r): r is Recipe => r !== undefined);
        return (
          <details key={plan.weekStart} className={styles.week}>
            <summary>
              Semaine du {formatDateFull(plan.weekStart)} · {plural(recipes.length, 'plat')}
            </summary>
            <ul className={styles.recipeLinks}>
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
  );
}
