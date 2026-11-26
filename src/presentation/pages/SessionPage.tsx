import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TRAINING_MESSAGES } from '@application/usecases';
import type {
  ActiveSessionResult,
  ActiveSessionView,
  CompanionView,
  ExerciseBody,
  SportRewardsView,
} from '@application/usecases';
import type { Sex } from '@domain/profile';
import { EFFORT_FEELINGS } from '@domain/training';
import type {
  EffortFeeling,
  Exercise,
  ExerciseLog,
  PlannedExercise,
  SetLog,
  SportAccessoryUnlock,
  TrainingSafetyMessage,
} from '@domain/training';
import { useDependencies } from '../app/dependencies';
import { Button, ButtonLink } from '../components/Button';
import { RadioGroup } from '../components/Choice';
import {
  BandageIcon,
  BookIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  HeartIcon,
  InfoIcon,
  SwapIcon,
  TimerIcon,
} from '../components/icons';
import { Notice } from '../components/Notice';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { useCompanionRefresh } from '../features/companion/Celebration';
import { Nutry } from '../features/companion/Nutry';
import { AlternativesSheet } from '../features/training/AlternativesSheet';
import type { BodyId } from '../features/training/figure/body';
import { ExerciseFigure } from '../features/training/figure/ExerciseFigure';
import { figureOf } from '../features/training/figure/exerciseFigure';
import { bodyFor, figureMuscles, setsSpoken, setsText } from '../features/training/format';
import { SetTracker } from '../features/training/SetTracker';
import { TimerRing } from '../features/training/TimerRing';
import { TutoSheet } from '../features/training/TutoSheet';
import { useRestTimer } from '../features/training/useRestTimer';
import type { TimerEnd } from '../features/training/useRestTimer';
import { useAsync } from '../hooks/useAsync';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  EFFORT_EMOJIS,
  EFFORT_LABELS,
  PROGRESSION_ADVICE_LABELS,
  SPORT_ACCESSORY_EMOJIS,
  SPORT_ACCESSORY_PHRASES,
  formatClock,
  formatKg,
  formatSeconds,
  plural,
} from '../i18n/labels';
import styles from './SessionPage.module.css';

type Phase = 'warmup' | 'main' | 'cooldown';

interface Step {
  readonly phase: Phase;
  readonly item: PlannedExercise;
}

const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  warmup: 'Échauffement',
  main: 'Séance',
  cooldown: 'Retour au calme',
};

/** Temps ajouté au repos par « +15 s ». */
const EXTRA_REST_SECONDS = 15;

interface Loaded {
  readonly result: ActiveSessionResult;
  readonly sex: Sex | undefined;
  readonly chosenBody: ExerciseBody | undefined;
}

interface Recap {
  readonly view: ActiveSessionView;
  readonly newAccessories: readonly SportAccessoryUnlock[];
  readonly rewards: SportRewardsView | undefined;
  readonly companion: CompanionView | undefined;
}

interface PainOutcome {
  readonly exerciseName: string;
  readonly messages: readonly TrainingSafetyMessage[];
  readonly replacement: Exercise | undefined;
}

const exerciseDone = (log: ExerciseLog | undefined): boolean =>
  log !== undefined && (log.done || (log.sets.length > 0 && log.sets.every((s) => s.done)));

/** Séance guidée, en mode concentré : un exercice à la fois, séries, repos, tuto, douleur. */
export function SessionPage() {
  const { weekStart = '', sessionId = '' } = useParams();
  const { startSession, getProfile, exerciseBody, keepScreenOn, releaseScreen } = useDependencies();

  const load = useCallback(async (): Promise<Loaded> => {
    const [result, profile] = await Promise.all([
      startSession({ weekStart, sessionId }),
      getProfile().catch(() => undefined),
    ]);
    return { result, sex: profile?.profile.sex, chosenBody: exerciseBody() };
  }, [startSession, getProfile, exerciseBody, weekStart, sessionId]);
  const { state, reload } = useAsync(load);

  // L'écran reste allumé pendant la séance (repli silencieux si le navigateur ne sait pas).
  useEffect(() => {
    void keepScreenOn();
    const again = () => {
      if (document.visibilityState === 'visible') void keepScreenOn();
    };
    document.addEventListener('visibilitychange', again);
    return () => {
      document.removeEventListener('visibilitychange', again);
      void releaseScreen();
    };
  }, [keepScreenOn, releaseScreen]);

  if (state.status === 'loading') {
    return (
      <SessionShell title="Séance">
        <p role="status" className={styles.status}>
          Je prépare ta séance…
        </p>
      </SessionShell>
    );
  }
  const data = state.status === 'ready' ? state.data : undefined;
  const result = data?.result;
  if (!result || result.status !== 'ready') {
    const message =
      result && 'message' in result
        ? result.message
        : 'La séance n’a pas pu s’ouvrir. Tes données sont intactes : réessaie dans un instant.';
    return (
      <SessionShell title="Séance">
        <div className={styles.problem}>
          <Notice
            tone="info"
            emoji={<InfoIcon size={20} />}
            title="Pas de séance ici pour l’instant"
          >
            {message}
          </Notice>
          <div className={styles.problemActions}>
            {result?.status !== 'unavailable' && (
              <Button variant="secondary" onClick={reload}>
                Réessayer
              </Button>
            )}
            <ButtonLink to="/sport">Retour au Sport</ButtonLink>
          </div>
        </div>
      </SessionShell>
    );
  }
  return <ActiveSession initial={result} body={bodyFor(data.sex, data.chosenBody)} />;
}

/** Coque minimale (chargement, erreur) : bouton de sortie et titre. */
function SessionShell({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  usePageTitle(title, headingRef);
  return (
    <div className={styles.session}>
      <header className={styles.top}>
        <Link to="/sport" className={styles.close} aria-label="Quitter la séance">
          <CloseIcon />
        </Link>
        <div className={styles.titles}>
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            {title}
          </h1>
        </div>
      </header>
      {children}
    </div>
  );
}

interface ActiveSessionProps {
  readonly initial: ActiveSessionView;
  readonly body: BodyId;
}

function ActiveSession({ initial, body }: ActiveSessionProps) {
  const deps = useDependencies();
  const toast = useToast();
  const navigate = useNavigate();
  const { refresh: refreshCompanion } = useCompanionRefresh();
  const [view, setView] = useState<ActiveSessionView>(initial);
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [tutoFor, setTutoFor] = useState<Exercise | undefined>();
  const [replacing, setReplacing] = useState<PlannedExercise | undefined>();
  const [alternatives, setAlternatives] = useState<readonly Exercise[] | undefined>();
  const [painFor, setPainFor] = useState<PlannedExercise | undefined>();
  const [pain, setPain] = useState<PainOutcome | undefined>();
  const [finishing, setFinishing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [effort, setEffort] = useState<EffortFeeling | undefined>();
  const [recap, setRecap] = useState<Recap | undefined>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const ref = useMemo(
    () => ({ weekStart: view.weekStart, sessionId: view.session.id }),
    [view.weekStart, view.session.id],
  );
  usePageTitle(view.session.title, headingRef);

  const steps = useMemo<Step[]>(
    () => [
      ...view.session.warmup.map((item) => ({ phase: 'warmup' as const, item })),
      ...view.session.main.map((item) => ({ phase: 'main' as const, item })),
      ...view.session.cooldown.map((item) => ({ phase: 'cooldown' as const, item })),
    ],
    [view.session],
  );

  const logOf = useCallback(
    (slotId: string) => view.log.exercises.find((e) => e.slotId === slotId),
    [view.log],
  );

  // Reprise : on revient au premier exercice principal qui n'est pas fini.
  const [index, setIndex] = useState(() => {
    const started = initial.log.exercises.some((e) => e.done || e.sets.some((s) => s.done));
    if (!started) return 0;
    const pending = steps.findIndex(
      (s) =>
        s.phase === 'main' &&
        !exerciseDone(initial.log.exercises.find((e) => e.slotId === s.item.slotId)),
    );
    return pending >= 0 ? pending : steps.findIndex((s) => s.phase === 'cooldown');
  });
  const [direction, setDirection] = useState<'next' | 'back'>('next');
  const safeIndex = Math.min(Math.max(index, 0), Math.max(steps.length - 1, 0));
  const step = steps[safeIndex];
  const isLast = safeIndex === steps.length - 1;

  const onTimerEnd = useCallback((reason: TimerEnd) => {
    if (reason === 'done') {
      // Vibration courte à la fin du repos (si l'appareil sait faire), et annonce polie.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- absent de certains navigateurs
      navigator.vibrate?.(200);
      setAnnouncement('Repos terminé : à toi pour la suite.');
    } else {
      setAnnouncement('Repos passé.');
    }
  }, []);
  const rest = useRestTimer({ onEnd: onTimerEnd });

  const onHoldEnd = useCallback((reason: TimerEnd) => {
    if (reason === 'done') {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- absent de certains navigateurs
      navigator.vibrate?.(200);
      setAnnouncement('C’est fait : passe au mouvement suivant quand tu veux.');
    }
  }, []);
  const hold = useRestTimer({ onEnd: onHoldEnd });

  const goTo = (target: number) => {
    if (target < 0 || target >= steps.length) return;
    setDirection(target > safeIndex ? 'next' : 'back');
    hold.stop();
    setIndex(target);
  };

  // Nouvel exercice : le nom prend le focus (annoncé par les lecteurs d'écran).
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    nameRef.current?.focus({ preventScroll: true });
  }, [safeIndex]);

  const apply = (result: ActiveSessionResult): boolean => {
    if (result.status === 'ready') {
      setView(result);
      return true;
    }
    if (result.status === 'failed' || result.status === 'unavailable') {
      toast.show(result.message, 'error');
    }
    return false;
  };

  const act = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch {
      toast.show('Oups, ça n’a pas fonctionné. Réessaie dans un instant.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (recap) return <SessionRecap recap={recap} />;
  if (!step) {
    return (
      <SessionShell title={view.session.title}>
        <p className={styles.status}>Cette séance ne contient aucun exercice pour l’instant.</p>
      </SessionShell>
    );
  }

  const slotId = step.item.slotId;
  const exerciseLog = step.phase === 'main' ? logOf(slotId) : undefined;
  // Après un remplacement, l'exercice fait est celui du journal.
  const exerciseId = exerciseLog?.exerciseId ?? step.item.exerciseId;
  const exercise = view.exercises[exerciseId];
  const prescription = step.item.prescription;
  const nextStep = steps[safeIndex + 1];
  const nextName = nextStep
    ? view.exercises[logOf(nextStep.item.slotId)?.exerciseId ?? nextStep.item.exerciseId]?.name
    : undefined;

  const onLogSet = (set: SetLog) => {
    void act(async () => {
      const ok = apply(await deps.logSet({ ...ref, slotId, set }));
      if (!ok) return;
      if (set.done) {
        rest.start(prescription.restSeconds);
        setAnnouncement(
          `Série ${set.index + 1} validée. Repos de ${formatSeconds(prescription.restSeconds)}.`,
        );
      } else {
        setAnnouncement(`Série ${set.index + 1} décochée.`);
      }
    });
  };

  const onAllDone = () => {
    void act(async () => {
      if (apply(await deps.markExerciseDone({ ...ref, slotId }))) {
        setAnnouncement('Exercice validé, bravo !');
      }
    });
  };

  const openAlternatives = () => {
    setReplacing(step.item);
    setAlternatives(undefined);
    void deps.getExerciseAlternatives({ ...ref, slotId }).then(
      (result) => {
        setAlternatives(result.status === 'ready' ? result.alternatives : []);
      },
      () => {
        setAlternatives([]);
      },
    );
  };

  const choose = (choice: Exercise) => {
    const target = replacing;
    if (!target) return;
    void act(async () => {
      const ok = apply(
        await deps.replaceExercise({ ...ref, slotId: target.slotId, exerciseId: choice.id }),
      );
      setReplacing(undefined);
      if (ok) toast.show(`C’est remplacé : ${choice.name}.`, 'success');
    });
  };

  const confirmPain = () => {
    const target = painFor;
    setPainFor(undefined);
    if (!target) return;
    const name = view.exercises[logOf(target.slotId)?.exerciseId ?? target.exerciseId]?.name ?? '';
    rest.stop();
    void act(async () => {
      const result = await deps.reportPain({ ...ref, slotId: target.slotId });
      if (result.status === 'reported') {
        setView(result.session);
        setPain({ exerciseName: name, messages: result.messages, replacement: result.replacement });
      } else if (result.status === 'failed' || result.status === 'unavailable') {
        toast.show(result.message, 'error');
      }
    });
  };

  const finish = () => {
    void act(async () => {
      const result = await deps.completeSession({ ...ref, ...(effort ? { effort } : {}) });
      if (result.status === 'completed') {
        rest.stop();
        setFinishing(false);
        setLeaving(false);
        refreshCompanion();
        const [rewards, companion] = await Promise.all([
          deps.getSportRewards().catch(() => undefined),
          deps.getCompanion().catch(() => undefined),
        ]);
        setRecap({
          view: result.session,
          newAccessories: result.newAccessories,
          rewards,
          companion,
        });
      } else if (result.status === 'nothing-done') {
        setFinishing(false);
        setLeaving(false);
        toast.show(result.message, 'info');
      } else if (result.status === 'failed' || result.status === 'unavailable') {
        toast.show(result.message, 'error');
      }
    });
  };

  const loadAdvice =
    step.phase === 'main'
      ? prescription.loadKg !== undefined
        ? `Charge conseillée : ${formatKg(prescription.loadKg)}`
        : PROGRESSION_ADVICE_LABELS[prescription.advice]
      : undefined;

  const showRest = step.phase === 'main' && rest.running;
  const doneSteps = steps.map((s, i) =>
    s.phase === 'main' ? exerciseDone(logOf(s.item.slotId)) : i < safeIndex,
  );

  return (
    <div className={styles.session}>
      <header className={styles.top}>
        <button
          type="button"
          className={styles.close}
          aria-label="Quitter la séance"
          onClick={() => {
            setLeaving(true);
          }}
        >
          <CloseIcon />
        </button>
        <div className={styles.titles}>
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            {view.session.title}
          </h1>
          <p className={styles.count}>
            {PHASE_LABELS[step.phase]} · {safeIndex + 1} sur {steps.length}
          </p>
        </div>
      </header>

      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Progression de la séance"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={safeIndex + 1}
        aria-valuetext={`Étape ${safeIndex + 1} sur ${steps.length} : ${exercise?.name ?? ''}`}
      >
        {steps.map((s, i) => (
          <span
            key={`${s.phase}-${s.item.slotId}`}
            className={[
              styles.segment,
              styles[s.phase],
              doneSteps[i] ? styles.segmentDone : '',
              i === safeIndex ? styles.segmentCurrent : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>

      <div key={`${safeIndex}-${exerciseId}`} className={styles.stage} data-direction={direction}>
        <div className={styles.figureCol}>
          {exercise && (
            <ExerciseFigure
              {...figureOf(exercise)}
              body={body}
              highlight={figureMuscles(exercise)}
              size="l"
              className={styles.figure}
            />
          )}
        </div>

        <div className={styles.info}>
          <div className={styles.heading}>
            <h2 ref={nameRef} tabIndex={-1} className={styles.name}>
              {exercise?.name ?? 'Exercice'}
            </h2>
            <p className={styles.meta}>
              <span aria-hidden="true">
                <strong>{setsText(prescription, step.item.unilateral)}</strong>
                {step.phase === 'main' && ` · repos ${formatSeconds(prescription.restSeconds)}`}
              </span>
              <span className="visually-hidden">
                {setsSpoken(prescription, step.item.unilateral)}
                {step.phase === 'main' && `, repos de ${formatSeconds(prescription.restSeconds)}`}
              </span>
            </p>
            {loadAdvice !== undefined && <p className={styles.advice}>{loadAdvice}</p>}
          </div>

          {step.phase === 'main' && exercise && exerciseLog && !showRest && (
            <SetTracker
              exercise={exercise}
              planned={step.item}
              log={exerciseLog}
              busy={busy}
              onLogSet={onLogSet}
              onAllDone={onAllDone}
            />
          )}

          {showRest && (
            <section className={styles.timerPanel} aria-label="Repos">
              <TimerRing remainingRatio={rest.total > 0 ? rest.remaining / rest.total : 0}>
                <span role="timer" className={styles.clock}>
                  {formatClock(rest.remaining)}
                </span>
              </TimerRing>
              <div className={styles.timerText}>
                <p className={styles.timerTitle}>Repos</p>
                <p className={styles.timerHint}>
                  {exerciseDone(exerciseLog)
                    ? nextName
                      ? `Ensuite : ${nextName}`
                      : 'Ensuite : on termine'
                    : 'Respire, la prochaine série arrive.'}
                </p>
              </div>
              <div className={styles.timerActions}>
                <Button
                  variant="secondary"
                  small
                  aria-label="Ajouter 15 secondes de repos"
                  onClick={() => {
                    rest.add(EXTRA_REST_SECONDS);
                  }}
                >
                  +15 s
                </Button>
                <Button small onClick={rest.skip}>
                  Passer
                </Button>
              </div>
            </section>
          )}

          {step.phase !== 'main' && (
            <section className={styles.timerPanel} aria-label="Minuteur">
              <TimerRing
                remainingRatio={hold.running && hold.total > 0 ? hold.remaining / hold.total : 1}
              >
                <span role="timer" className={styles.clock}>
                  {formatClock(hold.running ? hold.remaining : holdSecondsOf(step.item))}
                </span>
              </TimerRing>
              <div className={styles.timerText}>
                <p className={styles.timerTitle}>{PHASE_LABELS[step.phase]}</p>
                <p className={styles.timerHint}>
                  {step.phase === 'warmup'
                    ? 'En douceur, pour réveiller le corps.'
                    : 'Respire lentement, relâche les épaules.'}
                </p>
              </div>
              <div className={styles.timerActions}>
                {hold.running ? (
                  <Button variant="secondary" small onClick={hold.skip}>
                    Arrêter
                  </Button>
                ) : (
                  <Button
                    small
                    icon={<TimerIcon size={18} />}
                    onClick={() => {
                      hold.start(holdSecondsOf(step.item));
                      setAnnouncement(
                        `C’est parti pour ${formatSeconds(holdSecondsOf(step.item))}.`,
                      );
                    }}
                  >
                    Lancer
                  </Button>
                )}
              </div>
            </section>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.action}
              disabled={!exercise}
              onClick={() => {
                setTutoFor(exercise);
              }}
            >
              <BookIcon size={20} />
              Voir le tuto
            </button>
            {step.phase === 'main' && (
              <>
                <button
                  type="button"
                  className={styles.action}
                  disabled={busy}
                  onClick={openAlternatives}
                >
                  <SwapIcon size={20} />
                  Remplacer
                </button>
                <button
                  type="button"
                  className={`${styles.action} ${styles.pain}`}
                  disabled={busy}
                  onClick={() => {
                    setPainFor(step.item);
                  }}
                >
                  <BandageIcon size={20} />
                  Ça fait mal
                </button>
              </>
            )}
          </div>

          <nav className={styles.nav} aria-label="Exercices de la séance">
            <Button
              variant="ghost"
              className={styles.prev}
              disabled={safeIndex === 0}
              icon={<ChevronLeftIcon size={20} />}
              onClick={() => {
                goTo(safeIndex - 1);
              }}
            >
              Précédent
            </Button>
            {isLast ? (
              <Button
                className={styles.next}
                onClick={() => {
                  setFinishing(true);
                }}
              >
                Terminer la séance
              </Button>
            ) : (
              <Button
                className={styles.next}
                variant={
                  step.phase !== 'main' || exerciseDone(exerciseLog) ? 'primary' : 'secondary'
                }
                onClick={() => {
                  goTo(safeIndex + 1);
                }}
              >
                Exercice suivant
                <ChevronRightIcon size={20} />
              </Button>
            )}
          </nav>
        </div>
      </div>

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      <TutoSheet
        exercise={tutoFor}
        body={body}
        onClose={() => {
          setTutoFor(undefined);
        }}
      />

      <AlternativesSheet
        open={replacing !== undefined}
        currentName={exercise?.name}
        alternatives={alternatives}
        emptyMessage={TRAINING_MESSAGES.noReplacement}
        body={body}
        busy={busy}
        onChoose={choose}
        onClose={() => {
          setReplacing(undefined);
        }}
      />

      <Sheet
        open={painFor !== undefined}
        variant="dialog"
        role="alertdialog"
        title="Ça fait mal ?"
        description="On arrête cet exercice tout de suite. Je te propose un mouvement plus doux à la place."
        onClose={() => {
          setPainFor(undefined);
        }}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setPainFor(undefined);
              }}
            >
              Non, ça va
            </Button>
            <Button variant="danger" onClick={confirmPain}>
              Oui, ça fait mal
            </Button>
          </>
        }
      >
        <p className={styles.dialogText}>
          Une gêne musculaire passagère est normale. Une douleur vive, ou dans une articulation, ne
          l’est pas.
        </p>
      </Sheet>

      <Sheet
        open={pain !== undefined}
        variant="dialog"
        title="Prends soin de toi"
        onClose={() => {
          setPain(undefined);
        }}
        footer={
          <Button
            onClick={() => {
              setPain(undefined);
            }}
          >
            {pain?.replacement ? 'D’accord, on continue' : 'D’accord'}
          </Button>
        }
      >
        {pain && (
          <div className={styles.painBody}>
            {pain.messages.map((m) => (
              <Notice
                key={m.code}
                tone={m.code === 'urgence' ? 'danger' : 'accent'}
                emoji={<HeartIcon size={20} />}
              >
                {m.text}
              </Notice>
            ))}
            {pain.replacement ? (
              <p className={styles.replacement}>
                « {pain.exerciseName} » est mis de côté quatre semaines. À la place :{' '}
                <strong>{pain.replacement.name}</strong>.
              </p>
            ) : (
              <p className={styles.replacement}>{TRAINING_MESSAGES.noReplacement}</p>
            )}
          </div>
        )}
      </Sheet>

      <Sheet
        open={finishing}
        variant="dialog"
        title="Comment c’était ?"
        description="C’est facultatif : ça m’aide à ajuster la suite."
        onClose={() => {
          setFinishing(false);
        }}
        footer={
          <Button block disabled={busy} aria-busy={busy} onClick={finish}>
            Terminer la séance
          </Button>
        }
      >
        <RadioGroup
          legend="Ton ressenti (facultatif)"
          hideLegend
          layout="segmented"
          options={EFFORT_FEELINGS.map((e) => ({
            value: e,
            label: EFFORT_LABELS[e],
            emoji: EFFORT_EMOJIS[e],
          }))}
          value={effort}
          onChange={setEffort}
        />
      </Sheet>

      <Sheet
        open={leaving}
        variant="dialog"
        title="Quitter la séance ?"
        description="Tes séries validées sont gardées : tu peux reprendre plus tard."
        onClose={() => {
          setLeaving(false);
        }}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setLeaving(false);
                void navigate('/sport');
              }}
            >
              Reprendre plus tard
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setLeaving(false);
                setFinishing(true);
              }}
            >
              Terminer maintenant
            </Button>
          </>
        }
      >
        <p className={styles.dialogText}>Pas de pression : chaque série compte.</p>
      </Sheet>
    </div>
  );
}

/** Durée d'un mouvement d'échauffement ou de retour au calme (secondes). */
function holdSecondsOf(item: PlannedExercise): number {
  const { target } = item.prescription;
  return target.measure === 'duree' ? target.minSeconds : target.minReps * 4;
}

/** Fin de séance : Nutry fête ça, le récapitulatif, la série et l'accessoire gagné. */
function SessionRecap({ recap }: { readonly recap: Recap }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  usePageTitle('Séance terminée', headingRef);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  const { view, newAccessories, rewards, companion } = recap;
  const exercisesDone = view.log.exercises.filter(
    (e) => e.done || e.sets.some((s) => s.done),
  ).length;
  return (
    <section className={styles.recap} aria-labelledby="recap-title">
      <div className={styles.confetti} aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={styles.confettiPiece} data-i={i} />
        ))}
      </div>
      {companion && (
        <div className={styles.recapNutry}>
          <Nutry look={companion.look} mood="joyeux" size="l" />
        </div>
      )}
      <h1 id="recap-title" ref={headingRef} tabIndex={-1} className={styles.recapTitle}>
        Bravo, séance terminée{'\u202f'}!
      </h1>
      <p className={styles.recapSubtitle}>{view.session.title}</p>
      <ul className={styles.stats}>
        <li>
          <strong>{exercisesDone}</strong>
          <span>{exercisesDone > 1 ? 'exercices' : 'exercice'}</span>
        </li>
        <li>
          <strong>{view.completion.doneSets}</strong>
          <span>{view.completion.doneSets > 1 ? 'séries' : 'série'}</span>
        </li>
        <li>
          <strong>{companion?.streak ?? 1}</strong>
          <span>{(companion?.streak ?? 1) > 1 ? 'jours de suite' : 'jour de série'}</span>
        </li>
      </ul>
      {newAccessories.map((a) => (
        <Notice
          key={a.id}
          tone="success"
          emoji={<span aria-hidden="true">{SPORT_ACCESSORY_EMOJIS[a.id]}</span>}
          className={styles.unlock}
        >
          Nutry gagne <strong>{SPORT_ACCESSORY_PHRASES[a.id]}</strong> !
        </Notice>
      ))}
      {rewards?.next && newAccessories.length === 0 && (
        <p className={styles.recapNext}>
          Encore {plural(rewards.next.remaining, 'séance')} pour{' '}
          {SPORT_ACCESSORY_PHRASES[rewards.next.accessory.id]} de Nutry{' '}
          <span aria-hidden="true">{SPORT_ACCESSORY_EMOJIS[rewards.next.accessory.id]}</span>
        </p>
      )}
      <p className={styles.hydrate}>
        <span aria-hidden="true">💧</span> Pense à boire un grand verre d’eau.
      </p>
      <ButtonLink to="/sport" className={styles.recapButton}>
        Retour à ma semaine
      </ButtonLink>
    </section>
  );
}
