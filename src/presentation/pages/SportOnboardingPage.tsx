import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TrainingProfileView } from '@application/usecases';
import { DEFAULT_LOOK } from '@domain/companion';
import { TRAINING_QUESTIONS, defaultTrainingInput } from '@domain/training';
import type { TrainingInputIssue, TrainingProfileInput } from '@domain/training';
import { useDependencies } from '../app/dependencies';
import { Button } from '../components/Button';
import { ArrowLeftIcon, HeartIcon, ShieldIcon } from '../components/icons';
import { Notice } from '../components/Notice';
import { ScrollArea } from '../components/ScrollArea';
import { useToast } from '../components/Toast';
import { Nutry } from '../features/companion/Nutry';
import { useCompanion } from '../features/companion/useCompanion';
import { SportQuestion } from '../features/training/SportQuestions';
import { sportQuestionIds } from '../features/training/sportQuestionIds';
import type { SportQuestionId } from '../features/training/sportQuestionIds';
import { useAsync } from '../hooks/useAsync';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePageTitle } from '../hooks/usePageTitle';
import { frenchPunctuation } from '../i18n/labels';
import styles from './OnboardingPage.module.css';
import own from './SportOnboardingPage.module.css';

type ScreenId = SportQuestionId | 'safety';

/** Délai laissé à la carte choisie pour se voir avant de passer à la suite. */
const AUTO_ADVANCE_MS = 260;

/** Écrans à choix unique : un toucher passe à la suite. */
const AUTO_ADVANCE: ReadonlySet<ScreenId> = new Set(['frequency', 'level', 'goal']);

/**
 * Onboarding Sport (ADR 0015, section 9) : une question par écran, posée par Nutry, puis les
 * garde-fous à lire (« J'ai compris ») avant la première séance. Facultatif, jamais imposé.
 */
export function SportOnboardingPage() {
  const { getTrainingProfile, saveTrainingProfile, acknowledgeTrainingSafety } = useDependencies();
  const navigate = useNavigate();
  const toast = useToast();
  const { companion } = useCompanion();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const headingRef = useRef<HTMLHeadingElement>(null);
  usePageTitle('Sport : bienvenue', headingRef);

  const load = useCallback(() => getTrainingProfile(), [getTrainingProfile]);
  const { state } = useAsync(load);
  const loaded = state.status === 'ready' ? state.data : undefined;
  const askPregnancy =
    loaded !== undefined && loaded.status !== 'no-profile' && loaded.askPregnancyStage;

  const [draft, setDraft] = useState<TrainingProfileInput>(defaultTrainingInput);
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !loaded) return;
    seeded.current = true;
    if (loaded.status === 'inactive') setDraft(loaded.defaults);
    else if (loaded.status === 'active') setDraft(loaded.input);
  }, [loaded]);

  const screens = useMemo<ScreenId[]>(
    () => [...sportQuestionIds(askPregnancy), 'safety'],
    [askPregnancy],
  );
  const [currentId, setCurrentId] = useState<ScreenId>('frequency');
  const [direction, setDirection] = useState<'next' | 'back'>('next');
  const [issues, setIssues] = useState<readonly TrainingInputIssue[]>([]);
  const [saved, setSaved] = useState<Omit<TrainingProfileView, 'status'> | undefined>();
  const [saving, setSaving] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const firstRender = useRef(true);

  const index = Math.max(0, screens.indexOf(currentId));
  const lastQuestion = screens.length - 2;
  const isQuestion = currentId !== 'safety';

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [currentId]);

  useEffect(
    () => () => {
      clearTimeout(advanceTimer.current);
    },
    [],
  );

  const goTo = (id: ScreenId, dir: 'next' | 'back') => {
    clearTimeout(advanceTimer.current);
    setDirection(dir);
    setIssues([]);
    setCurrentId(id);
  };

  const save = async (input: TrainingProfileInput = draft) => {
    setSaving(true);
    try {
      const result = await saveTrainingProfile(input);
      if (result.status === 'invalid') {
        setIssues(result.issues);
        const field = result.issues[0]?.field;
        const screenOf: Partial<Record<TrainingInputIssue['field'], ScreenId>> = {
          sessionMinutes: 'duration',
          equipment: 'setting',
        };
        const target = screens.find((s) => s === (field && (screenOf[field] ?? field)));
        if (target) goTo(target, 'back');
        setIssues(result.issues);
        return;
      }
      if (result.status === 'saved') {
        setSaved(result);
        goTo('safety', 'next');
        return;
      }
      toast.show(
        result.status === 'failed' ? result.message : 'Complète d’abord ton profil.',
        'error',
      );
    } catch {
      toast.show('Oups, l’enregistrement n’a pas fonctionné. Réessaie.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const acknowledge = async () => {
    setSaving(true);
    try {
      const result = await acknowledgeTrainingSafety();
      if (result.status === 'failed') {
        toast.show(result.message, 'error');
        return;
      }
      void navigate('/sport', { replace: true });
    } catch {
      toast.show('Oups, ça n’a pas fonctionné. Réessaie.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const daysIssue =
    currentId === 'days' && draft.days.length !== draft.frequency
      ? `Choisis ${draft.frequency} jour${draft.frequency > 1 ? 's' : ''} (${draft.days.length} pour l’instant).`
      : undefined;

  const submit = () => {
    if (currentId === 'safety') {
      void acknowledge();
      return;
    }
    if (daysIssue !== undefined) {
      setIssues([{ field: 'days', message: daysIssue }]);
      return;
    }
    if (index >= lastQuestion) {
      void save();
      return;
    }
    const next = screens[index + 1];
    if (next) goTo(next, 'next');
  };

  const submitRef = useRef(submit);
  submitRef.current = submit;
  const onPick = () => {
    if (!AUTO_ADVANCE.has(currentId) || index >= lastQuestion) return;
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(
      () => {
        submitRef.current();
      },
      reducedMotion ? 0 : AUTO_ADVANCE_MS,
    );
  };

  const back = () => {
    const previous = screens[index - 1];
    if (previous && currentId !== 'safety') goTo(previous, 'back');
    else void navigate('/sport');
  };

  const question = isQuestion ? TRAINING_QUESTIONS[currentId] : undefined;
  const look = companion?.look ?? DEFAULT_LOOK;
  const optional = currentId === 'pregnancyStage';

  return (
    <div className={styles.onboarding}>
      <form
        className={styles.card}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className={styles.top}>
          {currentId !== 'safety' ? (
            <button
              type="button"
              className={styles.back}
              aria-label={index === 0 ? 'Retour au Sport' : 'Retour'}
              onClick={back}
            >
              <ArrowLeftIcon size={22} />
            </button>
          ) : (
            <span className={styles.brand} aria-hidden="true">
              <ShieldIcon size={20} />
            </span>
          )}
          <div
            className={styles.progress}
            role="progressbar"
            aria-label="Progression"
            aria-valuemin={1}
            aria-valuemax={screens.length}
            aria-valuenow={index + 1}
            aria-valuetext={`Étape ${index + 1} sur ${screens.length}`}
          >
            <div
              className={styles.progressFill}
              style={{ width: `${((index + 1) / screens.length) * 100}%` }}
            />
          </div>
        </div>

        <div key={currentId} className={styles.stage} data-direction={direction}>
          <div className={styles.ask}>
            <div className={styles.nutry}>
              <Nutry look={look} mood="joyeux" size="m" />
            </div>
            <div className={styles.bubble}>
              <p className={styles.eyebrow}>
                {currentId === 'safety' ? 'Avant de commencer' : 'Sport'}
              </p>
              <h1 ref={headingRef} tabIndex={-1} className={styles.question}>
                {frenchPunctuation(question?.prompt ?? 'Quelques repères pour bouger en sécurité')}
              </h1>
              {question?.hint !== undefined && <p className={styles.hint}>{question.hint}</p>}
            </div>
          </div>

          <ScrollArea
            label={
              currentId === 'safety'
                ? 'Repères de sécurité'
                : `Ta réponse : ${question?.label ?? ''}`
            }
            className={styles.answer}
          >
            <div className={styles.answerInner}>
              {state.status === 'loading' && (
                <p role="status" className={own.status}>
                  Un instant…
                </p>
              )}
              {currentId === 'safety' ? (
                <div className={own.safety}>
                  {(saved?.safety.messages ?? []).map((m) => (
                    <Notice
                      key={m.code}
                      tone={m.suggestProfessional ? 'accent' : 'info'}
                      emoji={<HeartIcon size={20} />}
                    >
                      {m.text}
                    </Notice>
                  ))}
                  <p className={own.disclaimer} role="note">
                    <ShieldIcon size={18} />
                    <span>{saved?.disclaimer}</span>
                  </p>
                </div>
              ) : (
                <SportQuestion
                  id={currentId}
                  variant="wizard"
                  draft={draft}
                  onChange={(patch) => {
                    setIssues([]);
                    setDraft((d) => ({ ...d, ...patch }));
                  }}
                  onPick={onPick}
                />
              )}
              {issues.length > 0 && (
                <p role="alert" className={own.issue}>
                  {issues.map((i) => i.message).join(' ')}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className={styles.actions}>
          {optional && (
            <Button
              variant="ghost"
              onClick={() => {
                // Sans réponse, la règle la plus prudente s'applique (ADR 0015).
                const skipped: TrainingProfileInput = {
                  frequency: draft.frequency,
                  days: draft.days,
                  setting: draft.setting,
                  equipment: draft.equipment,
                  level: draft.level,
                  goal: draft.goal,
                  sessionMinutes: draft.sessionMinutes,
                };
                setDraft(skipped);
                void save(skipped);
              }}
            >
              Passer
            </Button>
          )}
          <Button type="submit" disabled={saving} aria-busy={saving} className={styles.next}>
            {currentId === 'safety'
              ? 'J’ai compris'
              : index >= lastQuestion
                ? saving
                  ? 'Je prépare ton programme…'
                  : 'Créer mon programme'
                : 'Continuer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
