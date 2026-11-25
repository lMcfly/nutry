import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDependencies } from '../app/dependencies';
import { useAppState } from '../app/appState';
import { COMPANION_MESSAGES, DEFAULT_LOOK } from '@domain/companion';
import { FIRST_ONBOARDING_SCREEN, onboardingScreens, stepOfQuestion } from '@domain/profile';
import type { OnboardingScreenId, ProfileQuestionId } from '@domain/profile';
import { Button } from '../components/Button';
import { ArrowLeftIcon, LeafIcon, LockIcon } from '../components/icons';
import { APP_NAME } from '../components/Page';
import { ScrollArea } from '../components/ScrollArea';
import { useToast } from '../components/Toast';
import { Nutry } from '../features/companion/Nutry';
import { QuestionInput } from '../features/profile/ProfileSections';
import {
  DEFAULT_DRAFT,
  aboutIssues,
  aboutIssuesFrom,
  draftToProfile,
} from '../features/profile/draft';
import type { AboutField, AboutIssues, ProfileDraft } from '../features/profile/draft';
import { useMediaQuery } from '../hooks/useMediaQuery';
import styles from './OnboardingPage.module.css';

/** Champ validé par une question (les autres questions ont toujours une réponse valide). */
const FIELD_OF: Readonly<Partial<Record<ProfileQuestionId, AboutField>>> = {
  age: 'age',
  sex: 'sex',
  height: 'heightCm',
  weight: 'weightKg',
  waist: 'waistCm',
};

/** Questions posées en grand (seules sous la bulle) ; les autres sont compactes et groupées. */
const HERO_QUESTIONS: ReadonlySet<ProfileQuestionId> = new Set([
  'age',
  'sex',
  'activity',
  'healthCondition',
  'goal',
]);

/** Délai laissé à la carte choisie pour se voir avant de passer à la question suivante. */
const AUTO_ADVANCE_MS = 260;

export function OnboardingPage() {
  const { previewProfile, saveProfile, requestPersistentStorage, getCurrentPlan, markQuizShown } =
    useDependencies();
  const { setProfileStatus } = useAppState();
  const navigate = useNavigate();
  const toast = useToast();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [currentId, setCurrentId] = useState<OnboardingScreenId>('age');
  const [direction, setDirection] = useState<'next' | 'back'>('next');
  const [draft, setDraft] = useState<ProfileDraft>(DEFAULT_DRAFT);
  const [showIssues, setShowIssues] = useState(false);
  const [savedIssues, setSavedIssues] = useState<AboutIssues>({});
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const screens = useMemo(() => onboardingScreens(draft.sex), [draft.sex]);
  const index = Math.max(
    0,
    screens.findIndex((s) => s.id === currentId),
  );
  const screen = screens[index] ?? FIRST_ONBOARDING_SCREEN;
  const isLast = index === screens.length - 1;
  const step = stepOfQuestion(screen.questions[0] ?? 'age');
  const [waistOpen, setWaistOpen] = useState(false);
  const issues: AboutIssues = useMemo(() => aboutIssues(draft), [draft]);
  const profile = useMemo(() => draftToProfile(draft), [draft]);
  const health = useMemo(
    () => (profile ? previewProfile(profile).health : undefined),
    [profile, previewProfile],
  );
  const shownIssues = showIssues ? { ...savedIssues, ...issues } : {};

  useEffect(() => {
    document.title = `Bienvenue · ${APP_NAME}`;
  }, []);

  useEffect(() => {
    // Nouvel écran : on annonce la question (Nutry la pose, le titre prend le focus).
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

  const update = (patch: Partial<ProfileDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  };

  const goTo = (id: OnboardingScreenId, dir: 'next' | 'back') => {
    clearTimeout(advanceTimer.current);
    setDirection(dir);
    setShowIssues(false);
    setCurrentId(id);
  };

  const finish = async () => {
    const firstWithIssue = (known: AboutIssues): OnboardingScreenId =>
      screens.find((sc) =>
        sc.questions.some((q) => {
          const field = FIELD_OF[q];
          return field !== undefined && known[field] !== undefined;
        }),
      )?.id ?? 'age';
    if (!profile) {
      setShowIssues(true);
      goTo(firstWithIssue(issues), 'back');
      setShowIssues(true);
      return;
    }
    setSaving(true);
    try {
      const result = await saveProfile(profile);
      if (result.status === 'invalid') {
        const known = aboutIssuesFrom(result.issues);
        setSavedIssues(known);
        goTo(firstWithIssue(known), 'back');
        setShowIssues(true);
        return;
      }
      // Fin de l'onboarding, dans le gestionnaire du clic (ADR 0009).
      if (result.firstProfile) void requestPersistentStorage();
      await getCurrentPlan();
      // La question du moment attendra la prochaine ouverture : place au menu.
      markQuizShown();
      setProfileStatus('ready');
      void navigate('/semaine', { replace: true });
    } catch {
      toast.show('Oups, l’enregistrement n’a pas fonctionné. Réessaie.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const advance = () => {
    const next = screens[index + 1];
    if (next) goTo(next.id, 'next');
    else void finish();
  };

  const submit = () => {
    const blocked = screen.questions.some((q) => {
      const field = FIELD_OF[q];
      return field !== undefined && issues[field] !== undefined;
    });
    if (blocked) {
      setShowIssues(true);
      return;
    }
    advance();
  };

  // Choix au doigt, sur un écran qui n'a qu'un seul choix : on laisse voir la carte cochée, puis
  // on passe à la suite (sauf à la fin : enregistrer le profil demande un geste volontaire).
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const onPick = () => {
    if (isLast || !screen.autoAdvance) return;
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(
      () => {
        submitRef.current();
      },
      reducedMotion ? 0 : AUTO_ADVANCE_MS,
    );
  };

  const skip = () => {
    advance();
  };

  const back = () => {
    const previous = screens[index - 1];
    if (previous) goTo(previous.id, 'back');
  };

  const input = (id: ProfileQuestionId) => (
    <QuestionInput
      key={id}
      id={id}
      variant={HERO_QUESTIONS.has(id) ? 'wizard' : 'group'}
      draft={draft}
      onChange={update}
      issues={shownIssues}
      health={health}
      onPick={onPick}
    />
  );

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
          {index > 0 ? (
            <button type="button" className={styles.back} aria-label="Retour" onClick={back}>
              <ArrowLeftIcon size={22} />
            </button>
          ) : (
            <p className={styles.brand}>
              <LeafIcon size={20} />
              <span>{APP_NAME}</span>
            </p>
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

        <div key={screen.id} className={styles.stage} data-direction={direction}>
          <div className={styles.ask}>
            <div className={styles.nutry}>
              <Nutry look={DEFAULT_LOOK} mood="joyeux" size="m" />
            </div>
            <div className={styles.bubble}>
              <p className={styles.eyebrow}>{screen.eyebrow ?? step.title}</p>
              <h1 ref={headingRef} tabIndex={-1} className={styles.question}>
                {screen.prompt}
              </h1>
              {index === 0 ? (
                <p className={styles.hint}>{COMPANION_MESSAGES.welcome}</p>
              ) : (
                screen.hint !== undefined && <p className={styles.hint}>{screen.hint}</p>
              )}
            </div>
          </div>

          <ScrollArea label={`Ta réponse : ${screen.label}`} className={styles.answer}>
            <div className={styles.answerInner}>
              {screen.id === 'body' ? (
                <>
                  <div className={styles.pair}>
                    {(['height', 'weight'] as const).map((id) => input(id))}
                  </div>
                  {waistOpen ? (
                    <div className={styles.waist}>
                      {input('waist')}
                      <Button
                        variant="ghost"
                        small
                        onClick={() => {
                          update({ waistCm: '' });
                          setWaistOpen(false);
                        }}
                      >
                        Retirer mon tour de taille
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      className={styles.addWaist}
                      onClick={() => {
                        setWaistOpen(true);
                      }}
                    >
                      + Ajouter mon tour de taille
                    </Button>
                  )}
                </>
              ) : (
                screen.questions.map((id) => input(id))
              )}
              {index === 0 && (
                <p className={styles.privacy}>
                  <LockIcon size={16} />
                  <span>
                    Aucun compte, aucun serveur. <Link to="/confidentialite">Confidentialité</Link>
                  </span>
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className={styles.actions}>
          {screen.optional && !isLast && (
            <Button variant="ghost" onClick={skip}>
              Passer
            </Button>
          )}
          <Button type="submit" disabled={saving} aria-busy={saving} className={styles.next}>
            {isLast ? (saving ? 'Je prépare ton menu…' : 'Voir mon menu') : 'Continuer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
