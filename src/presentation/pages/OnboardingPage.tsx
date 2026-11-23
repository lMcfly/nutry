import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDependencies } from '../app/dependencies';
import { markQuizShownThisSession, useAppState } from '../app/appState';
import { Button } from '../components/Button';
import { APP_NAME } from '../components/Page';
import { useToast } from '../components/Toast';
import {
  AboutSection,
  GoalSection,
  OrganisationSection,
  TastesSection,
} from '../features/profile/ProfileSections';
import {
  DEFAULT_DRAFT,
  aboutIssues,
  draftToProfile,
  withAllowedGoal,
} from '../features/profile/draft';
import type { AboutIssues, ProfileDraft } from '../features/profile/draft';
import styles from './OnboardingPage.module.css';

interface Step {
  readonly title: string;
  readonly intro: string;
  readonly emoji: string;
  /** Écran facultatif : bouton « Passer ». */
  readonly optional: boolean;
}

const FIRST_STEP: Step = {
  title: 'Faisons connaissance',
  intro: 'Pour ajuster tes portions. Tout reste sur ton téléphone.',
  emoji: '👋',
  optional: false,
};

const STEPS: readonly Step[] = [
  FIRST_STEP,
  {
    title: 'Ton objectif',
    intro: 'Et ce que tu ne manges pas.',
    emoji: '🎯',
    optional: true,
  },
  {
    title: 'Tes goûts',
    intro: 'Touche ce que tu adores… et ce que tu évites.',
    emoji: '😋',
    optional: true,
  },
  {
    title: 'Ton organisation',
    intro: 'Pour un menu qui tient dans ta semaine.',
    emoji: '🗓️',
    optional: true,
  },
];

export function OnboardingPage() {
  const { previewProfile, saveProfile, requestPersistentStorage, getCurrentPlan } =
    useDependencies();
  const { setProfileStatus } = useAppState();
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(DEFAULT_DRAFT);
  const [showIssues, setShowIssues] = useState(false);
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const current = STEPS[step] ?? FIRST_STEP;
  const issues: AboutIssues = useMemo(() => aboutIssues(draft), [draft]);
  const profile = useMemo(() => draftToProfile(draft), [draft]);
  const health = useMemo(
    () => (profile ? previewProfile(profile).health : undefined),
    [profile, previewProfile],
  );

  useEffect(() => {
    document.title = `Bienvenue · ${APP_NAME}`;
  }, []);

  useEffect(() => {
    // Nouvel écran : on remonte et on annonce son titre.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, [step]);

  const update = (patch: Partial<ProfileDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  };

  const finish = async () => {
    if (!profile) {
      setShowIssues(true);
      setStep(0);
      return;
    }
    setSaving(true);
    try {
      const result = await saveProfile(withAllowedGoal(profile, health?.lossAllowed ?? true));
      if (result.status === 'invalid') {
        setShowIssues(true);
        setStep(0);
        return;
      }
      // Fin de l'onboarding, dans le gestionnaire du clic (ADR 0009).
      if (result.firstProfile) void requestPersistentStorage();
      await getCurrentPlan();
      // La question du jour attendra la prochaine ouverture : place au menu.
      markQuizShownThisSession();
      setProfileStatus('ready');
      navigate('/semaine', { replace: true });
    } catch {
      toast.show('Oups, l’enregistrement n’a pas fonctionné. Réessaie.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 0 && Object.keys(issues).length > 0) {
      setShowIssues(true);
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
    else void finish();
  };

  const isLast = step === STEPS.length - 1;

  return (
    <div className={styles.onboarding}>
      <div className={styles.top}>
        <p className={styles.brand}>
          <span aria-hidden="true">🌿</span> {APP_NAME}
        </p>
        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Progression"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-valuetext={`Étape ${step + 1} sur ${STEPS.length}`}
        >
          <div
            className={styles.progressFill}
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <p className={styles.stepCount}>
          Étape {step + 1} sur {STEPS.length}
        </p>
      </div>

      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          next();
        }}
      >
        <header className={styles.header}>
          <span className={styles.emoji} aria-hidden="true">
            {current.emoji}
          </span>
          <h1 ref={headingRef} tabIndex={-1}>
            {current.title}
          </h1>
          <p className={styles.intro}>{current.intro}</p>
        </header>

        {step === 0 && (
          <AboutSection draft={draft} onChange={update} issues={showIssues ? issues : {}} />
        )}
        {step === 1 && <GoalSection draft={draft} onChange={update} health={health} />}
        {step === 2 && <TastesSection draft={draft} onChange={update} />}
        {step === 3 && <OrganisationSection draft={draft} onChange={update} />}

        <div className={styles.actions}>
          {step > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                setStep(step - 1);
              }}
            >
              Retour
            </Button>
          )}
          <div className={styles.spacer} />
          {current.optional && !isLast && (
            <Button
              variant="secondary"
              onClick={() => {
                setStep(step + 1);
              }}
            >
              Passer
            </Button>
          )}
          <Button type="submit" disabled={saving} aria-busy={saving}>
            {isLast ? (saving ? 'Je prépare ton menu…' : 'Voir mon menu') : 'Continuer'}
          </Button>
        </div>
        {step === 0 && (
          <p className={styles.privacy}>
            <span aria-hidden="true">🔒 </span>
            Aucun compte, aucun serveur. <Link to="/confidentialite">Confidentialité</Link>
          </p>
        )}
      </form>
    </div>
  );
}
