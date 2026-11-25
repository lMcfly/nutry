import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  CompanionView,
  ExerciseBody,
  TrainingWeekResult,
  TrainingWeekView,
} from '@application/usecases';
import { DEFAULT_LOOK } from '@domain/companion';
import type { DayIndex } from '@domain/mealplan';
import type { Sex } from '@domain/profile';
import { daysBetween } from '@domain/shared';
import { TRAINING_DISCLAIMER, TRAINING_INVITATION } from '@domain/training';
import type { CycleInfo, MuscleGroup, PlannedSession } from '@domain/training';
import { useDependencies } from '../app/dependencies';
import { Button, ButtonLink } from '../components/Button';
import { DayStrip } from '../components/DayStrip';
import {
  BookIcon,
  BulbIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  DumbbellIcon,
  HeartIcon,
  InfoIcon,
  MoreIcon,
  PlayIcon,
  SettingsIcon,
} from '../components/icons';
import { ListGroup, ListRow } from '../components/ListRow';
import { Notice } from '../components/Notice';
import { Page } from '../components/Page';
import { RoundIconButton } from '../components/RoundIconButton';
import { ScrollArea } from '../components/ScrollArea';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { Nutry } from '../features/companion/Nutry';
import { useCompanion } from '../features/companion/useCompanion';
import { ExerciseThumb } from '../features/training/ExerciseThumb';
import type { BodyId } from '../features/training/figure/body';
import { bodyFor, setsText, weekDates } from '../features/training/format';
import { HistorySheet } from '../features/training/HistorySheet';
import { SportSettingsSheet } from '../features/training/SportSettingsSheet';
import { useAsync } from '../hooks/useAsync';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
  DAY_LABELS,
  DAY_SHORT_LABELS,
  MUSCLE_GROUP_LABELS,
  formatDayLong,
  formatDayOfMonth,
  frenchPunctuation,
  plural,
} from '../i18n/labels';
import styles from './SportPage.module.css';

interface SportData {
  readonly week: TrainingWeekResult;
  readonly sex: Sex | undefined;
  readonly chosenBody: ExerciseBody | undefined;
}

/** Grand écran : la séance du jour et la semaine côte à côte. */
const WIDE_QUERY = '(min-width: 1000px) and (min-height: 540px)';
const TABLET_QUERY = '(min-width: 768px) and (min-height: 540px)';

/** Sous-titre de la semaine : où on en est dans le cycle, la semaine légère dite avec douceur. */
function cycleText(cycle: CycleInfo): string {
  if (cycle.deload) {
    return cycle.deloadReason === 'reprise'
      ? 'Semaine de reprise, en douceur'
      : 'Semaine allégée, pour bien récupérer';
  }
  return `Semaine ${cycle.weekInBlock} sur ${cycle.blockLength}`;
}

/** Onglet Sport : la semaine d'entraînement, la séance du jour mise en avant. */
export function SportPage() {
  const { getTrainingWeek, getProfile, exerciseBody } = useDependencies();
  const load = useCallback(async (): Promise<SportData> => {
    const [week, profile] = await Promise.all([
      getTrainingWeek(),
      getProfile().catch(() => undefined),
    ]);
    return { week, sex: profile?.profile.sex, chosenBody: exerciseBody() };
  }, [getTrainingWeek, getProfile, exerciseBody]);
  const { state, reload } = useAsync(load);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const navigate = useNavigate();

  const data = state.status === 'ready' ? state.data : undefined;
  const week = data?.week;
  const ready = week?.status === 'ready' ? week : undefined;

  return (
    <Page
      title="Sport"
      subtitle={ready ? cycleText(ready.plan.cycle) : undefined}
      actions={
        ready && (
          <RoundIconButton
            icon={<MoreIcon />}
            label="Plus d’options"
            onClick={() => {
              setMenuOpen(true);
            }}
          />
        )
      }
    >
      {state.status === 'loading' && (
        <div className={styles.loading} aria-hidden="true" data-testid="sport-skeleton">
          <div className={styles.skeletonStrip} />
          <div className={styles.skeletonCard} />
        </div>
      )}
      {state.status === 'loading' && (
        <p role="status" className="visually-hidden">
          Je prépare ta semaine d’entraînement…
        </p>
      )}
      {(state.status === 'error' || week?.status === 'failed') && (
        <Notice
          tone="info"
          emoji={<InfoIcon size={20} />}
          title="Le Sport fait une petite pause"
          action={
            <Button small variant="secondary" onClick={reload}>
              Réessayer
            </Button>
          }
        >
          {week?.status === 'failed'
            ? week.message
            : 'Le Sport n’a pas pu se charger. Tes données sont intactes : réessaie dans un instant.'}
        </Notice>
      )}
      {week?.status === 'inactive' && <Invitation onLater={() => void navigate('/semaine')} />}
      {ready && data && (
        <SportWeek
          week={ready}
          body={bodyFor(data.sex, data.chosenBody)}
          onHistory={() => {
            setHistoryOpen(true);
          }}
          onAcknowledged={reload}
        />
      )}

      <Sheet
        open={menuOpen}
        title="Mon sport"
        onClose={() => {
          setMenuOpen(false);
        }}
      >
        <ListGroup label="Options du Sport">
          <ListRow
            icon={<SettingsIcon />}
            title="Mon programme"
            hint="jours, matériel, durée"
            onClick={() => {
              setMenuOpen(false);
              setSettingsOpen(true);
            }}
          />
          <ListRow
            icon={<CalendarIcon />}
            title="Mes séances"
            onClick={() => {
              setMenuOpen(false);
              setHistoryOpen(true);
            }}
          />
          <ListRow icon={<BookIcon />} title="Crédits exercices" to="/credits-exercices" />
        </ListGroup>
      </Sheet>
      <SportSettingsSheet
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
        }}
        onSaved={reload}
      />
      <HistorySheet
        open={historyOpen}
        onClose={() => {
          setHistoryOpen(false);
        }}
      />
    </Page>
  );
}

/** Premier passage : Nutry propose (jamais n'impose) une semaine d'entraînement. */
function Invitation({ onLater }: { readonly onLater: () => void }) {
  const { companion } = useCompanion();
  return (
    <section className={styles.invitation} aria-labelledby="invitation-title">
      <div className={styles.invitationNutry}>
        <Nutry look={companion?.look ?? DEFAULT_LOOK} mood="joyeux" size="l" />
      </div>
      <div className={styles.invitationBubble}>
        <h2 id="invitation-title" className={styles.invitationTitle}>
          {frenchPunctuation(TRAINING_INVITATION.title)}
        </h2>
        <p>{TRAINING_INVITATION.body}</p>
      </div>
      <div className={styles.invitationActions}>
        <ButtonLink to="/sport/bienvenue" className={styles.invitationAccept}>
          {TRAINING_INVITATION.accept}
        </ButtonLink>
        <Button variant="ghost" onClick={onLater}>
          {TRAINING_INVITATION.decline}
        </Button>
      </div>
      <p className={styles.disclaimer} role="note">
        {TRAINING_DISCLAIMER}
      </p>
    </section>
  );
}

interface SportWeekProps {
  readonly week: TrainingWeekView;
  readonly body: BodyId;
  readonly onHistory: () => void;
  readonly onAcknowledged: () => void;
}

function SportWeek({ week, body, onHistory, onAcknowledged }: SportWeekProps) {
  const { acknowledgeTrainingSafety } = useDependencies();
  const navigate = useNavigate();
  const toast = useToast();
  const { companion } = useCompanion();
  const wide = useMediaQuery(WIDE_QUERY);
  const tablet = useMediaQuery(TABLET_QUERY);
  const dates = useMemo(() => weekDates(week.plan.weekStart), [week.plan.weekStart]);
  const todayIndex = Math.min(6, Math.max(0, daysBetween(week.plan.weekStart, week.today)));
  const [selected, setSelected] = useState<number>(todayIndex);
  const [notesOpen, setNotesOpen] = useState(false);
  const [safetyFor, setSafetyFor] = useState<PlannedSession | undefined>();
  const [acknowledging, setAcknowledging] = useState(false);

  const sessionOn = (day: number) => week.plan.sessions.find((s) => s.dayIndex === day);
  const session = sessionOn(selected);
  const date = dates[selected] ?? week.today;
  const isToday = date === week.today;
  const nextSession = week.plan.sessions.find(
    (s) => s.dayIndex > selected && week.logs[s.id]?.status !== 'terminee',
  );

  const open = (target: PlannedSession) => {
    if (week.needsAcknowledgement) {
      setSafetyFor(target);
      return;
    }
    void navigate(`/sport/seance/${week.plan.weekStart}/${target.id}`);
  };

  const acknowledge = async () => {
    const target = safetyFor;
    setAcknowledging(true);
    try {
      const result = await acknowledgeTrainingSafety();
      if (result.status === 'failed') {
        toast.show(result.message, 'error');
        return;
      }
      setSafetyFor(undefined);
      onAcknowledged();
      if (target) void navigate(`/sport/seance/${week.plan.weekStart}/${target.id}`);
    } finally {
      setAcknowledging(false);
    }
  };

  const tallPhone = useMediaQuery('(min-height: 701px)');
  // Téléphone haut : grille 2 × 2 ; téléphone bas : une rangée de trois ; grand écran : six.
  const previewCount = wide || tablet ? 6 : tallPhone ? 4 : 3;
  const protectiveMessages = week.safety.messages.filter((m) => m.suggestProfessional);

  return (
    <div className={styles.layout}>
      <DayStrip
        idPrefix="sport-jour"
        className={styles.days}
        label="Jours de la semaine d’entraînement"
        value={String(selected)}
        onChange={(id) => {
          setSelected(Number(id));
        }}
        days={dates.map((d, i) => {
          const s = sessionOn(i);
          const done = s !== undefined && week.logs[s.id]?.status === 'terminee';
          return {
            id: String(i),
            weekday: DAY_SHORT_LABELS[i as DayIndex],
            dayOfMonth: formatDayOfMonth(d),
            ariaLabel: `${formatDayLong(d)}${d === week.today ? ', aujourd’hui' : ''}${
              s ? (done ? ', séance faite' : `, ${s.title}`) : ', repos'
            }`,
            isToday: d === week.today,
            mark: s ? (done ? ('fait' as const) : ('seance' as const)) : undefined,
          };
        })}
      />

      <div className={styles.main}>
        {session ? (
          <SessionCard
            session={session}
            week={week}
            body={body}
            dayLabel={`${DAY_LABELS[selected as DayIndex]} ${formatDayOfMonth(date)}`}
            isToday={isToday}
            previewCount={previewCount}
            onOpen={open}
          />
        ) : (
          <RestCard
            companion={companion}
            dayLabel={`${DAY_LABELS[selected as DayIndex]} ${formatDayOfMonth(date)}`}
            isToday={isToday}
            next={nextSession}
            onNext={(s) => {
              setSelected(s.dayIndex);
            }}
          />
        )}

        <aside className={styles.summary} aria-label="Ma semaine d’entraînement">
          {wide && companion && (
            <div className={styles.summaryNutry}>
              <Nutry look={companion.look} mood={companion.mood} size="m" />
            </div>
          )}
          {wide && (
            <ul className={styles.weekList} aria-label="Séances de la semaine">
              {week.plan.sessions.map((s) => {
                const done = week.logs[s.id]?.status === 'terminee';
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`${styles.weekRow} ${s.dayIndex === selected ? styles.weekRowOn : ''}`}
                      aria-label={`${DAY_LABELS[s.dayIndex]} : ${s.title}${done ? ', faite' : ''}`}
                      onClick={() => {
                        setSelected(s.dayIndex);
                      }}
                    >
                      <span className={styles.weekDay}>{DAY_SHORT_LABELS[s.dayIndex]}</span>
                      <span className={styles.weekTitle}>{s.title}</span>
                      {done && <CheckCircleIcon size={18} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className={styles.progress}>
            <span className={styles.dots} aria-hidden="true">
              {week.plan.sessions.map((s) => (
                <span
                  key={s.id}
                  className={week.logs[s.id]?.status === 'terminee' ? styles.dotDone : styles.dot}
                />
              ))}
            </span>
            <span className={styles.progressText}>
              {week.doneSessions} {week.doneSessions > 1 ? 'séances' : 'séance'} sur{' '}
              {week.plannedSessions}
            </span>
          </div>
          <div className={styles.summaryActions}>
            {week.plan.notices.length > 0 && (
              <Button
                variant="ghost"
                small
                icon={<BulbIcon size={18} />}
                onClick={() => {
                  setNotesOpen(true);
                }}
              >
                Bon à savoir
              </Button>
            )}
            <Button variant="ghost" small icon={<CalendarIcon size={18} />} onClick={onHistory}>
              Mes séances
            </Button>
          </div>
        </aside>
      </div>

      <p className={styles.disclaimer} role="note">
        {week.disclaimer}
      </p>

      <Sheet
        open={notesOpen}
        variant="dialog"
        title="Bon à savoir"
        onClose={() => {
          setNotesOpen(false);
        }}
      >
        <div className={styles.notes}>
          {week.plan.notices.map((n) => (
            <Notice key={n.code} tone="info" emoji={<BulbIcon size={20} />}>
              {n.message}
            </Notice>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={safetyFor !== undefined}
        variant="dialog"
        title="Avant de commencer"
        description="Quelques repères pour bouger en sécurité."
        onClose={() => {
          setSafetyFor(undefined);
        }}
        footer={
          <Button
            block
            disabled={acknowledging}
            onClick={() => {
              void acknowledge();
            }}
          >
            J’ai compris
          </Button>
        }
      >
        <div className={styles.notes}>
          {(protectiveMessages.length > 0 ? protectiveMessages : week.safety.messages).map((m) => (
            <Notice key={m.code} tone="accent" emoji={<HeartIcon size={20} />}>
              {m.text}
            </Notice>
          ))}
          <p className={styles.sheetNote}>{week.disclaimer}</p>
        </div>
      </Sheet>
    </div>
  );
}

interface SessionCardProps {
  readonly session: PlannedSession;
  readonly week: TrainingWeekView;
  readonly body: BodyId;
  readonly dayLabel: string;
  readonly isToday: boolean;
  readonly previewCount: number;
  readonly onOpen: (session: PlannedSession) => void;
}

/** Groupes du jour : ceux sollicités fortement, sinon ceux des exercices (séance douce). */
function musclesOf(session: PlannedSession, week: TrainingWeekView): MuscleGroup[] {
  if (session.heavyGroups.length > 0) return [...session.heavyGroups];
  const groups = new Set<MuscleGroup>();
  for (const item of session.main) {
    for (const m of week.exercises[item.exerciseId]?.primaryMuscles ?? []) groups.add(m);
  }
  return [...groups];
}

function SessionCard({
  session,
  week,
  body,
  dayLabel,
  isToday,
  previewCount,
  onOpen,
}: SessionCardProps) {
  const log = week.logs[session.id];
  const done = log?.status === 'terminee';
  const started = log !== undefined && !done;
  const muscles = musclesOf(session, week);
  // Une case de moins quand il en reste : la dernière dit « +N ».
  const shown = session.main.slice(
    0,
    session.main.length > previewCount && previewCount === 4 ? 3 : previewCount,
  );
  const more = session.main.length - shown.length;
  const exerciseOf = (slotId: string, plannedId: string) =>
    week.exercises[log?.exercises.find((e) => e.slotId === slotId)?.exerciseId ?? plannedId];

  return (
    <section
      className={`${styles.card} ${isToday ? styles.today : ''}`}
      aria-labelledby="seance-titre"
      data-testid="sport-session"
    >
      <div className={styles.cardText}>
        <div className={styles.cardHead}>
          <p className={styles.eyebrow}>
            {isToday ? 'Aujourd’hui' : dayLabel}
            {session.kind === 'douce' ? ' · séance douce' : ''}
          </p>
          {done && (
            <span className={styles.badgeDone}>
              <CheckCircleIcon size={16} /> Faite
            </span>
          )}
          {started && <span className={styles.badge}>En cours</span>}
        </div>
        <h2 id="seance-titre" className={styles.title}>
          {session.title}
        </h2>
        <p className={styles.meta}>
          <ClockIcon size={16} />
          <span>
            environ {session.estimatedMinutes} min · {plural(session.main.length, 'exercice')}
          </span>
        </p>
        {muscles.length > 0 && (
          <ul className={styles.muscles} aria-label="Muscles travaillés">
            {muscles.map((m) => (
              <li key={m}>{MUSCLE_GROUP_LABELS[m]}</li>
            ))}
          </ul>
        )}
        <ScrollArea label="Au programme" className={styles.program}>
          <ol className={styles.programList}>
            {session.warmup.length > 0 && (
              <li className={styles.programPhase}>
                <span>Échauffement</span>
                <span>{plural(session.warmup.length, 'mouvement')}</span>
              </li>
            )}
            {session.main.map((item) => (
              <li key={item.slotId}>
                <span className={styles.programName}>
                  {exerciseOf(item.slotId, item.exerciseId)?.name ?? 'Exercice'}
                </span>
                <span className={styles.programSets}>
                  {setsText(item.prescription, item.unilateral)}
                </span>
              </li>
            ))}
            {session.cooldown.length > 0 && (
              <li className={styles.programPhase}>
                <span>Retour au calme</span>
                <span>{plural(session.cooldown.length, 'mouvement')}</span>
              </li>
            )}
          </ol>
        </ScrollArea>
        <Button
          className={styles.start}
          variant={done ? 'secondary' : 'primary'}
          icon={done ? <CheckCircleIcon size={22} /> : <PlayIcon size={22} />}
          onClick={() => {
            onOpen(session);
          }}
        >
          {done ? 'Revoir la séance' : started ? 'Reprendre la séance' : 'Commencer la séance'}
        </Button>
      </div>

      <ul
        className={styles.preview}
        aria-label="Aperçu des exercices"
        data-columns={shown.length <= 4 ? 2 : 3}
      >
        {shown.map((item) => {
          const exercise = exerciseOf(item.slotId, item.exerciseId);
          if (!exercise) return null;
          return (
            <li key={item.slotId} className={styles.previewItem}>
              <ExerciseThumb exercise={exercise} body={body} className={styles.previewThumb} />
              <span className={styles.previewName}>{exercise.name}</span>
            </li>
          );
        })}
        {more > 0 && (
          <li className={styles.previewMore}>
            <span aria-hidden="true">+{more}</span>
            <span className="visually-hidden">et {plural(more, 'autre exercice')}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

interface RestCardProps {
  readonly companion: CompanionView | undefined;
  readonly dayLabel: string;
  readonly isToday: boolean;
  readonly next: PlannedSession | undefined;
  readonly onNext: (session: PlannedSession) => void;
}

/** Jour sans séance : le repos fait partie du programme, Nutry fait la sieste. */
function RestCard({ companion, dayLabel, isToday, next, onNext }: RestCardProps) {
  return (
    <section className={`${styles.card} ${styles.rest}`} aria-labelledby="repos-titre">
      <div className={styles.restNutry}>
        <Nutry look={companion?.look ?? DEFAULT_LOOK} mood="sieste" size="l" />
      </div>
      <div className={styles.restText}>
        <p className={styles.eyebrow}>{isToday ? 'Aujourd’hui' : dayLabel}</p>
        <h2 id="repos-titre" className={styles.title}>
          Jour de repos
        </h2>
        <p className={styles.restBody}>
          Récupérer fait partie du programme. Une petite marche ou quelques étirements si l’envie te
          prend, sinon rien du tout.
        </p>
        {next && (
          <Button
            variant="secondary"
            icon={<DumbbellIcon size={20} />}
            onClick={() => {
              onNext(next);
            }}
          >
            Prochaine séance : {DAY_LABELS[next.dayIndex].toLowerCase()}
          </Button>
        )}
      </div>
    </section>
  );
}
