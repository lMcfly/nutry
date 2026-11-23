import { useCallback, useState } from 'react';
import type { PlanOrigin, PlanView } from '@application/usecases';
import type { BalanceGauge, BatchPrep, DayIndex, PlannedMeal } from '@domain/mealplan';
import type { RatingReason, RatingVerdict } from '@domain/preferences';
import { useDependencies } from '../app/dependencies';
import { Button, ButtonLink } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Gauge } from '../components/Gauge';
import { Notice } from '../components/Notice';
import { Page } from '../components/Page';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { BackupReminder } from '../features/data/BackupReminder';
import { MealCard } from '../features/week/MealCard';
import { ReplaceSheet } from '../features/week/ReplaceSheet';
import { useAsync } from '../hooks/useAsync';
import { formatDayLong, formatDayShort } from '../i18n/labels';
import styles from './WeekPage.module.css';

interface WeekData {
  readonly view: PlanView;
  readonly balance: readonly BalanceGauge[];
  readonly batch: readonly BatchPrep[];
}

const GAUGE_EMOJIS: Readonly<Record<BalanceGauge['key'], string>> = {
  vegetables: '🥦',
  legumes: '🫘',
  fish: '🐟',
  wholeGrains: '🌾',
};

/** Date du jour (locale) au format ISO, pour repérer « aujourd'hui ». */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function WeekPage() {
  const deps = useDependencies();
  const {
    getCurrentPlan,
    getWeekBalance,
    getBatchCookingPlan,
    generateWeeklyPlan,
    replaceMeal,
    rateMeal,
    removeRating,
  } = deps;
  const toast = useToast();
  const [origin, setOrigin] = useState<PlanOrigin | undefined>();
  const [replacing, setReplacing] = useState<PlannedMeal | undefined>();
  const [confirmNew, setConfirmNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hideRegenerated, setHideRegenerated] = useState(false);

  const load = useCallback(async (): Promise<WeekData | undefined> => {
    const view = await getCurrentPlan();
    if (view.status !== 'ready') return undefined;
    setOrigin((o) => o ?? view.origin);
    const [balance, batch] = await Promise.all([getWeekBalance(), getBatchCookingPlan()]);
    return { view, balance, batch };
  }, [getCurrentPlan, getWeekBalance, getBatchCookingPlan]);

  const { state, reload } = useAsync(load);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch {
      toast.show('Oups, ça n’a pas fonctionné. Réessaie dans un instant.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onRate = (view: PlanView) => (meal: PlannedMeal, verdict: RatingVerdict) => {
    void run(async () => {
      const current = view.ratings[meal.id];
      if (current?.verdict === verdict) {
        await removeRating(current.id);
        toast.show('Avis retiré.');
      } else {
        await rateMeal({ weekStart: view.plan.weekStart, mealId: meal.id, verdict });
        toast.show(
          verdict === 'up'
            ? 'Noté ! On te le reproposera.'
            : 'Merci, on en tiendra compte pour la suite.',
          'success',
        );
      }
      reload();
    });
  };

  const onReason = (view: PlanView) => (meal: PlannedMeal, reason: RatingReason) => {
    void run(async () => {
      await rateMeal({ weekStart: view.plan.weekStart, mealId: meal.id, verdict: 'down', reason });
      reload();
    });
  };

  const onChoose = (meal: PlannedMeal, recipeId: string) => {
    setReplacing(undefined);
    void run(async () => {
      const result = await replaceMeal({ mealId: meal.id, recipeId });
      if (result.status === 'unavailable') {
        toast.show('Ce plat n’est plus disponible, choisis-en un autre.', 'error');
      } else {
        toast.show('C’est remplacé !', 'success');
      }
      reload();
    });
  };

  const newMenu = () => {
    setConfirmNew(false);
    void run(async () => {
      await generateWeeklyPlan();
      setHideRegenerated(true);
      toast.show('Ton nouveau menu est prêt.', 'success');
      reload();
    });
  };

  const data = state.status === 'ready' ? state.data : undefined;

  return (
    <Page
      title="Ma semaine"
      subtitle={
        data ? `Semaine du ${formatDayShort(data.view.plan.weekStart)}` : 'Ton menu, en douceur'
      }
      actions={
        data ? (
          <Button
            variant="secondary"
            small
            icon="✨"
            disabled={busy}
            onClick={() => {
              setConfirmNew(true);
            }}
          >
            Nouveau menu
          </Button>
        ) : undefined
      }
    >
      <ButtonLink to="/frigo" variant="accent" block icon="🧊">
        Frigo vide ? Cuisine avec ce que tu as
      </ButtonLink>

      <BackupReminder />

      {state.status === 'loading' && (
        <p role="status" className={styles.loading}>
          Je prépare ton menu…
        </p>
      )}
      {state.status === 'error' && (
        <Notice tone="danger" emoji="😕" title="Le menu n’a pas pu se charger">
          <Button small variant="secondary" onClick={reload}>
            Réessayer
          </Button>
        </Notice>
      )}
      {state.status === 'ready' && !data && (
        <EmptyState emoji="🥗" title="Pas encore de menu">
          Complète ton profil pour recevoir ton menu de la semaine.
        </EmptyState>
      )}

      {data && (
        <WeekContent
          data={data}
          origin={hideRegenerated ? undefined : origin}
          busy={busy}
          onReplace={setReplacing}
          onRate={onRate(data.view)}
          onReason={onReason(data.view)}
        />
      )}

      <ReplaceSheet
        meal={replacing}
        currentName={replacing ? data?.view.recipes[replacing.recipeId]?.name : undefined}
        onClose={() => {
          setReplacing(undefined);
        }}
        onChoose={onChoose}
      />

      <Sheet
        open={confirmNew}
        variant="dialog"
        role="alertdialog"
        title="Un nouveau menu ?"
        description="Il remplace celui de cette semaine, en tenant compte de tes avis."
        onClose={() => {
          setConfirmNew(false);
        }}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmNew(false);
              }}
            >
              Garder celui-ci
            </Button>
            <Button onClick={newMenu}>Oui, on change</Button>
          </>
        }
      >
        <p className={styles.dialogText}>
          <span aria-hidden="true">🌱 </span>Tes 👍 et 👎 orientent les nouvelles idées.
        </p>
      </Sheet>
    </Page>
  );
}

interface WeekContentProps {
  readonly data: WeekData;
  readonly origin: PlanOrigin | undefined;
  readonly busy: boolean;
  readonly onReplace: (meal: PlannedMeal) => void;
  readonly onRate: (meal: PlannedMeal, verdict: RatingVerdict) => void;
  readonly onReason: (meal: PlannedMeal, reason: RatingReason) => void;
}

function WeekContent({ data, origin, busy, onReplace, onRate, onReason }: WeekContentProps) {
  const { view, balance, batch } = data;
  const meals = view.plan.meals;
  const byId = new Map(meals.map((m) => [m.id, m]));
  const leftoverBySource = new Map(
    meals.filter((m) => m.leftoverOf !== undefined).map((m) => [m.leftoverOf ?? '', m]),
  );
  const days = new Map<DayIndex, PlannedMeal[]>();
  for (const meal of meals) {
    const list = days.get(meal.dayIndex) ?? [];
    list.push(meal);
    days.set(meal.dayIndex, list);
  }
  const relaxed = meals.some((m) => m.relaxed.length > 0);
  const notices = view.plan.notices;
  const today = localToday();

  return (
    <>
      {origin === 'regenerated' && (
        <Notice tone="success" emoji="🔄" live>
          Ton profil a changé : on t’a préparé un menu qui lui correspond.
        </Notice>
      )}
      {notices.map((n) => (
        <Notice key={n.code} tone="info" emoji="💡">
          {n.message}
        </Notice>
      ))}
      {relaxed && !notices.some((n) => n.code === 'contraintes-assouplies') && (
        <Notice tone="info" emoji="💡">
          Quelques repas sortent un peu de tes critères (niveau, temps ou variété) : on manquait
          d’idées qui cochent toutes les cases.
        </Notice>
      )}

      <div className={styles.days}>
        {[...days.entries()].map(([dayIndex, dayMeals]) => {
          const date = dayMeals[0]?.date ?? '';
          const isToday = date === today;
          return (
            <section
              key={dayIndex}
              className={`${styles.day} ${isToday ? styles.today : ''}`}
              aria-labelledby={`jour-${dayIndex}`}
            >
              <h2 id={`jour-${dayIndex}`} className={styles.dayTitle}>
                {formatDayLong(date)}
                {isToday && <span className={styles.todayBadge}>Aujourd’hui</span>}
              </h2>
              <div className={styles.meals}>
                {dayMeals.map((meal) => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    recipe={view.recipes[meal.recipeId]}
                    explanation={view.explanations[meal.id]}
                    rating={view.ratings[meal.id]}
                    leftoverSource={meal.leftoverOf ? byId.get(meal.leftoverOf) : undefined}
                    feedsLeftover={leftoverBySource.get(meal.id)}
                    busy={busy}
                    onReplace={onReplace}
                    onRate={onRate}
                    onReason={onReason}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {batch.length > 0 && (
        <Card as="section" tone="soft" aria-labelledby="batch-title">
          <h2 id="batch-title" className={styles.sectionTitle}>
            <span aria-hidden="true">🥘 </span>Batch cooking du dimanche
          </h2>
          <p className={styles.sectionIntro}>À préparer d’avance pour une semaine sereine :</p>
          <ul className={styles.batchList}>
            {batch.map((prep) => (
              <li key={prep.recipe.id}>
                <ButtonLink to={`/recette/${prep.recipe.id}`} variant="ghost" small>
                  {prep.recipe.name}
                </ButtonLink>
                <span className={styles.batchMeals}>pour {prep.mealLabels.join(', ')}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {balance.length > 0 && (
        <Card as="section" aria-labelledby="balance-title">
          <h2 id="balance-title" className={styles.sectionTitle}>
            <span aria-hidden="true">🌈 </span>L’équilibre de ta semaine
          </h2>
          <p className={styles.sectionIntro}>De la variété, sans rien compter.</p>
          <div className={styles.gauges}>
            {balance.map((g) => (
              <Gauge
                key={g.key}
                label={g.label}
                count={g.count}
                target={g.target}
                emoji={GAUGE_EMOJIS[g.key]}
              />
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
