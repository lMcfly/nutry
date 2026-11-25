import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CompanionView, PlanOrigin, PlanView } from '@application/usecases';
import { MEAL_SLOTS } from '@domain/mealplan';
import type {
  BalanceGauge,
  BatchPrepGroup,
  DayIndex,
  MealSlot,
  PlannedMeal,
} from '@domain/mealplan';
import { RATING_REASONS } from '@domain/preferences';
import type { RatingReason, RatingVerdict } from '@domain/preferences';
import { useDependencies } from '../app/dependencies';
import { Button, ButtonLink } from '../components/Button';
import { DayStrip } from '../components/DayStrip';
import { EmptyState } from '../components/EmptyState';
import { Gauge } from '../components/Gauge';
import { RadioGroup } from '../components/Choice';
import { Notice } from '../components/Notice';
import { Page } from '../components/Page';
import {
  BulbIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DatabaseIcon,
  FlameIcon,
  FridgeIcon,
  HomeIcon,
  InfoIcon,
  MoreIcon,
  PotIcon,
  SparkleIcon,
} from '../components/icons';
import { ListGroup, ListRow } from '../components/ListRow';
import { RoundIconButton } from '../components/RoundIconButton';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { panelId, tabId } from '../components/tabIds';
import { Sheet } from '../components/Sheet';
import { Swipeable } from '../components/Swipeable';
import type { SwipeDirection } from '../components/Swipeable';
import { useToast } from '../components/Toast';
import { Nutry } from '../features/companion/Nutry';
import { useCelebrationCheck, useCompanionRefresh } from '../features/companion/Celebration';
import { useCompanion } from '../features/companion/useCompanion';
import { BALANCE_EMOJIS, BALANCE_TONES } from '../features/plate/balanceTones';
import { useBackupReminder } from '../features/data/useBackupReminder';
import { MealCard } from '../features/week/MealCard';
import { ReplaceSheet } from '../features/week/ReplaceSheet';
import { useAsync } from '../hooks/useAsync';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
  DAY_LABELS,
  DAY_SHORT_LABELS,
  RATING_REASON_LABELS,
  SLOT_LABELS,
  SLOT_SHORT_LABELS,
  formatDayLong,
  formatDayOfMonth,
  plural,
} from '../i18n/labels';
import styles from './WeekPage.module.css';

export const DISLIKED_TOAST = 'Compris : ce plat ne reviendra plus dans tes prochains menus.';
export const REPLACE_NOW_LABEL = 'Remplacer ce plat maintenant';

interface WeekData {
  readonly view: PlanView;
  readonly balance: readonly BalanceGauge[];
  readonly batch: readonly BatchPrepGroup[];
  /** Jours de séance de la semaine (Sport activé), repérés dans le bandeau. */
  readonly trainingDays: readonly DayIndex[];
}

const slotRank = (slot: MealSlot): number => MEAL_SLOTS.indexOf(slot);

export function WeekPage() {
  const deps = useDependencies();
  const {
    getCurrentPlan,
    getWeekBalance,
    getBatchCookingPlan,
    getTrainingDays,
    generateWeeklyPlan,
    replaceMeal,
    rateMeal,
    removeRating,
  } = deps;
  const toast = useToast();
  const checkCelebration = useCelebrationCheck();
  const { refresh: refreshCompanion } = useCompanionRefresh();
  const { companion } = useCompanion();
  const [origin, setOrigin] = useState<PlanOrigin | undefined>();
  const [replacing, setReplacing] = useState<PlannedMeal | undefined>();
  const [reasonFor, setReasonFor] = useState<PlannedMeal | undefined>();
  const [confirmNew, setConfirmNew] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();
  const backup = useBackupReminder();
  const [busy, setBusy] = useState(false);
  const [hideRegenerated, setHideRegenerated] = useState(false);

  const load = useCallback(async (): Promise<WeekData | undefined> => {
    const view = await getCurrentPlan();
    if (view.status !== 'ready') return undefined;
    setOrigin((o) => o ?? view.origin);
    const [balance, batch, training] = await Promise.all([
      getWeekBalance(),
      getBatchCookingPlan(),
      // Le lien avec le Sport est facultatif : sans lui (ou en cas d'échec), rien ne change.
      getTrainingDays().catch(() => undefined),
    ]);
    const trainingDays = training?.weekStart === view.plan.weekStart ? training.trainingDays : [];
    return { view, balance, batch, trainingDays };
  }, [getCurrentPlan, getWeekBalance, getBatchCookingPlan, getTrainingDays]);

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
        // 👎 : on propose (sans insister) d'en dire la raison ; la célébration éventuelle
        // attend que cette petite fenêtre soit refermée (`closeReasons`).
        if (verdict === 'down') setReasonFor(meal);
        else checkCelebration();
      }
      refreshCompanion();
      reload();
    });
  };

  const closeReasons = () => {
    setReasonFor(undefined);
    checkCelebration();
  };

  const onReason = (view: PlanView, meal: PlannedMeal, reason: RatingReason) => {
    closeReasons();
    void run(async () => {
      await rateMeal({ weekStart: view.plan.weekStart, mealId: meal.id, verdict: 'down', reason });
      if (reason === 'pas-aime') {
        // L'avis écarte déjà ce plat des prochains menus ; on propose d'agir tout de suite.
        toast.show(DISLIKED_TOAST, 'info', {
          label: REPLACE_NOW_LABEL,
          onClick: () => {
            setReplacing(meal);
          },
        });
      }
      refreshCompanion();
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
  const reasonView = data?.view;
  const reasonRating = reasonFor && reasonView ? reasonView.ratings[reasonFor.id] : undefined;

  return (
    <Page
      title="Ma semaine"
      subtitle={
        <>
          Bonjour <span aria-hidden="true">👋</span>
        </>
      }
      actions={
        <>
          {companion && (
            <Link
              to="/moi"
              className={styles.nutryLink}
              aria-label="Nutry, mon petit compagnon"
              title={companion.message}
            >
              <Nutry look={companion.look} mood={companion.mood} size="s" />
            </Link>
          )}
          {data && (
            <RoundIconButton
              icon={<MoreIcon />}
              label="Plus d’options"
              dot={backup.due}
              onClick={() => {
                setShowMenu(true);
              }}
            />
          )}
        </>
      }
    >
      {state.status === 'loading' && (
        <p role="status" className={styles.loading}>
          Je prépare ton menu…
        </p>
      )}
      {state.status === 'error' && (
        <Notice tone="danger" emoji={<InfoIcon size={20} />} title="Le menu n’a pas pu se charger">
          <Button small variant="secondary" onClick={reload}>
            Réessayer
          </Button>
        </Notice>
      )}
      {state.status === 'ready' && !data && (
        <EmptyState emoji={<HomeIcon size={28} />} title="Pas encore de menu">
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
          companion={companion}
          onShowBatch={() => {
            setShowBatch(true);
          }}
        />
      )}

      <Sheet
        open={showMenu}
        title="Cette semaine"
        onClose={() => {
          setShowMenu(false);
        }}
      >
        <ListGroup label="Options de la semaine">
          <ListRow
            to="/frigo"
            icon={<FridgeIcon />}
            title="Frigo vide"
            ariaLabel="Frigo vide : cuisiner avec ce que tu as"
          />
          <ListRow
            icon={<CalendarIcon />}
            title="Équilibre de la semaine"
            onClick={() => {
              setShowMenu(false);
              setShowBalance(true);
            }}
          />
          {(data?.batch.length ?? 0) > 0 && (
            <ListRow
              icon={<PotIcon />}
              title="Cuisiner en avance le dimanche"
              onClick={() => {
                setShowMenu(false);
                setShowBatch(true);
              }}
            />
          )}
          <ListRow
            icon={<SparkleIcon />}
            title="Nouveau menu"
            disabled={busy}
            onClick={() => {
              setShowMenu(false);
              setConfirmNew(true);
            }}
          />
          {backup.due && (
            <ListRow
              icon={<DatabaseIcon />}
              title="Sauvegarder mes données"
              ariaLabel="Sauvegarde conseillée : sauvegarder mes données"
              dot
              onClick={() => {
                backup.dismiss();
                setShowMenu(false);
                void navigate('/moi#mes-donnees');
              }}
            />
          )}
        </ListGroup>
      </Sheet>

      <ReplaceSheet
        meal={replacing}
        currentName={replacing ? data?.view.recipes[replacing.recipeId]?.name : undefined}
        onClose={() => {
          setReplacing(undefined);
        }}
        onChoose={onChoose}
      />

      <Sheet
        open={reasonFor !== undefined}
        variant="dialog"
        title="Une raison ?"
        description="C’est facultatif, mais ça m’aide à mieux choisir la suite."
        onClose={closeReasons}
        footer={
          <Button variant="ghost" onClick={closeReasons}>
            Passer
          </Button>
        }
      >
        {reasonFor && reasonView && (
          <RadioGroup
            legend="Une raison ? (facultatif)"
            hideLegend
            options={RATING_REASONS.map((r) => ({ value: r, label: RATING_REASON_LABELS[r] }))}
            value={reasonRating?.reason}
            onChange={(reason) => {
              onReason(reasonView, reasonFor, reason);
            }}
          />
        )}
      </Sheet>

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
          Tes avis (j’ai aimé, pas pour moi) orientent les nouvelles idées.
        </p>
      </Sheet>

      <Sheet
        open={showBatch && (data?.batch.length ?? 0) > 0}
        title="Cuisiner en avance le dimanche"
        description="Une heure ou deux le dimanche, et les soirs de semaine vont plus vite."
        onClose={() => {
          setShowBatch(false);
        }}
      >
        {data && <BatchContent batch={data.batch} />}
      </Sheet>

      <Sheet
        open={showBalance}
        title="L’équilibre de ta semaine"
        description="De la variété, sans rien compter."
        onClose={() => {
          setShowBalance(false);
        }}
      >
        {data && <BalanceContent data={data} />}
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
  readonly companion: CompanionView | undefined;
  readonly onShowBatch: () => void;
}

/** Tablette et ordinateur : les repas du jour sont affichés ensemble, sans onglets. */
const DAY_VIEW_QUERY = '(min-width: 768px) and (min-height: 540px)';
/** Très grand écran : colonne « Ta semaine » à droite. */
const ASIDE_QUERY =
  '(min-width: 1280px) and (min-height: 540px), (min-width: 768px) and (max-width: 999px) and (min-height: 1000px)';

function WeekContent({
  data,
  origin,
  busy,
  onReplace,
  onRate,
  companion,
  onShowBatch,
}: WeekContentProps) {
  const { view } = data;
  const dayView = useMediaQuery(DAY_VIEW_QUERY);
  const withAside = useMediaQuery(ASIDE_QUERY);
  const { today: getToday } = useDependencies();
  const today = getToday();

  /** Tous les repas dans l'ordre de la semaine : le glissement les parcourt de proche en proche. */
  const ordered = useMemo(
    () =>
      [...view.plan.meals].sort(
        (a, b) => a.dayIndex - b.dayIndex || slotRank(a.slot) - slotRank(b.slot),
      ),
    [view.plan.meals],
  );
  const byId = useMemo(() => new Map(ordered.map((m) => [m.id, m])), [ordered]);
  const leftoverBySource = useMemo(
    () =>
      new Map(
        ordered.filter((m) => m.leftoverOf !== undefined).map((m) => [m.leftoverOf ?? '', m]),
      ),
    [ordered],
  );
  const days = useMemo(() => {
    const seen = new Map<number, string>();
    for (const meal of ordered) if (!seen.has(meal.dayIndex)) seen.set(meal.dayIndex, meal.date);
    return [...seen.entries()].map(([dayIndex, date]) => ({ dayIndex, date }));
  }, [ordered]);

  const initialId = useMemo(
    () => (ordered.find((m) => m.date === today) ?? ordered[0])?.id,
    [ordered, today],
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId);
  const [direction, setDirection] = useState<SwipeDirection>('next');

  const index = Math.max(
    0,
    ordered.findIndex((m) => m.id === selectedId),
  );
  const meal = ordered[index];
  if (!meal) return null;

  const goTo = (id: string, dir?: SwipeDirection) => {
    const target = ordered.findIndex((m) => m.id === id);
    if (target < 0) return;
    setDirection(dir ?? (target >= index ? 'next' : 'prev'));
    setSelectedId(id);
  };
  const step = (dir: SwipeDirection) => {
    const target = ordered[index + (dir === 'next' ? 1 : -1)];
    if (target) goTo(target.id, dir);
  };
  const pickDay = (dayIndex: number) => {
    const sameDay = ordered.filter((m) => m.dayIndex === dayIndex);
    const target = sameDay.find((m) => m.slot === meal.slot) ?? sameDay[0];
    if (target) goTo(target.id);
  };
  const pickSlot = (slot: MealSlot) => {
    const target = ordered.find((m) => m.dayIndex === meal.dayIndex && m.slot === slot);
    if (target) goTo(target.id);
  };

  const dayMeals = ordered.filter((m) => m.dayIndex === meal.dayIndex);
  const dayLabel = `${formatDayLong(meal.date)}${meal.date === today ? ', aujourd’hui' : ''}`;

  const renderCard = (m: PlannedMeal) => (
    <MealCard
      key={m.id}
      meal={m}
      recipe={view.recipes[m.recipeId]}
      explanation={view.explanations[m.id]}
      rating={view.ratings[m.id]}
      leftoverSource={m.leftoverOf ? byId.get(m.leftoverOf) : undefined}
      feedsLeftover={leftoverBySource.get(m.id)}
      busy={busy}
      onReplace={onReplace}
      onRate={onRate}
      onGoTo={(id) => {
        goTo(id);
      }}
    />
  );

  return (
    <>
      {origin === 'regenerated' && (
        <Notice tone="success" emoji={<SparkleIcon size={20} />} live>
          Ton profil a changé : on t’a préparé un menu qui lui correspond.
        </Notice>
      )}

      <div
        className={[styles.layout, dayView ? styles.dayView : '', withAside ? styles.withAside : '']
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.side}>
          <DayStrip
            idPrefix="jour"
            className={styles.days}
            value={String(meal.dayIndex)}
            onChange={(id) => {
              pickDay(Number(id));
            }}
            days={days.map(({ dayIndex, date }) => {
              const training = data.trainingDays.includes(dayIndex as DayIndex);
              return {
                id: String(dayIndex),
                weekday: DAY_SHORT_LABELS[dayIndex as DayIndex],
                dayOfMonth: formatDayOfMonth(date),
                ariaLabel: `${formatDayLong(date)}${date === today ? ', aujourd’hui' : ''}${training ? ', jour de séance' : ''}`,
                isToday: date === today,
                mark: training ? ('seance' as const) : undefined,
              };
            })}
          />

          {!dayView && (
            <div className={styles.mealRow}>
              <RoundIconButton
                icon={<ChevronLeftIcon size={22} />}
                label="Repas précédent"
                disabled={index === 0}
                onClick={() => {
                  step('prev');
                }}
              />
              <SegmentedTabs
                idPrefix="repas"
                label={`Repas de ${DAY_LABELS[meal.dayIndex].toLowerCase()}`}
                value={meal.slot}
                onChange={pickSlot}
                tabs={dayMeals.map((m) => ({
                  id: m.slot,
                  ariaLabel: SLOT_LABELS[m.slot],
                  label: SLOT_SHORT_LABELS[m.slot],
                }))}
              />
              <RoundIconButton
                icon={<ChevronRightIcon size={22} />}
                label="Repas suivant"
                disabled={index === ordered.length - 1}
                onClick={() => {
                  step('next');
                }}
              />
            </div>
          )}
        </div>

        <p className="visually-hidden" aria-live="polite">
          {dayLabel}
          {dayView ? '' : `, ${SLOT_LABELS[meal.slot].toLowerCase()}`}
        </p>

        {dayView ? (
          <section
            className={styles.dayMeals}
            style={{ '--meals': dayMeals.length } as CSSProperties}
            aria-label={`Repas : ${dayLabel}`}
          >
            {dayMeals.map(renderCard)}
          </section>
        ) : (
          <div
            role="tabpanel"
            id={panelId('repas', meal.slot)}
            aria-labelledby={tabId('repas', meal.slot)}
            className={styles.panel}
          >
            <Swipeable
              className={styles.swipe}
              itemKey={meal.id}
              direction={direction}
              onSwipe={step}
            >
              {renderCard(meal)}
            </Swipeable>
          </div>
        )}

        {withAside && (
          <WeekAside
            companion={companion}
            balance={data.balance}
            hasBatch={data.batch.length > 0}
            onShowBatch={onShowBatch}
          />
        )}
      </div>
    </>
  );
}

interface WeekAsideProps {
  readonly companion: CompanionView | undefined;
  readonly balance: readonly BalanceGauge[];
  readonly hasBatch: boolean;
  readonly onShowBatch: () => void;
}

/** Colonne discrète des très grands écrans : Nutry et la série, l'équilibre, le dimanche. */
function WeekAside({ companion, balance, hasBatch, onShowBatch }: WeekAsideProps) {
  return (
    <aside className={styles.aside} aria-labelledby="aside-title">
      <h2 id="aside-title" className={styles.asideTitle}>
        Ta semaine
      </h2>
      {companion && (
        <div className={styles.asideNutry}>
          <Nutry look={companion.look} mood={companion.mood} size="m" />
          <p className={styles.asideStreak}>
            <FlameIcon size={18} />
            {companion.streak > 0
              ? `${plural(companion.streak, 'jour')} de suite`
              : 'Pas de série en cours'}
          </p>
        </div>
      )}
      <div className={styles.asideGauges}>
        {balance.map((g) => (
          <Gauge
            key={g.key}
            label={g.label}
            count={g.count}
            target={g.target}
            tone={BALANCE_TONES[g.key]}
          />
        ))}
      </div>
      {hasBatch && (
        <Button variant="ghost" small icon={<PotIcon size={20} />} onClick={onShowBatch}>
          Cuisiner en avance le dimanche
        </Button>
      )}
    </aside>
  );
}

function BatchContent({ batch }: { readonly batch: readonly BatchPrepGroup[] }) {
  return (
    <div className={styles.batch}>
      {batch.map((group) => (
        <section
          key={group.kind}
          className={styles.batchGroup}
          aria-labelledby={`batch-${group.kind}`}
        >
          <h3 id={`batch-${group.kind}`} className={styles.batchTitle}>
            {group.title}
          </h3>
          <p className={styles.batchHint}>{group.hint}</p>
          <ul className={styles.batchList}>
            {group.tasks.map((task) => (
              <li key={task.label}>
                {group.kind === 'plat-entier' && task.recipeIds[0] ? (
                  <ButtonLink to={`/recette/${task.recipeIds[0]}`} variant="ghost" small>
                    {task.label}
                  </ButtonLink>
                ) : (
                  <span className={styles.batchTask}>{task.label}</span>
                )}
                <span className={styles.batchMeals}>pour {task.mealLabels.join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function BalanceContent({ data }: { readonly data: WeekData }) {
  const { view, balance } = data;
  const meals = view.plan.meals;
  const relaxed = meals.some((m) => m.relaxed.length > 0);
  const notices = view.plan.notices;
  return (
    <div className={styles.balance}>
      <div className={styles.gauges}>
        {balance.map((g) => (
          <Gauge
            key={g.key}
            label={g.label}
            count={g.count}
            target={g.target}
            emoji={BALANCE_EMOJIS[g.key]}
            tone={BALANCE_TONES[g.key]}
          />
        ))}
      </div>
      {notices.map((n) => (
        <Notice key={n.code} tone="info" emoji={<BulbIcon size={20} />}>
          {n.message}
        </Notice>
      ))}
      {relaxed && !notices.some((n) => n.code === 'contraintes-assouplies') && (
        <Notice tone="info" emoji={<BulbIcon size={20} />}>
          Quelques repas sortent un peu de tes critères (niveau, temps ou variété) : on manquait
          d’idées qui cochent toutes les cases.
        </Notice>
      )}
    </div>
  );
}
