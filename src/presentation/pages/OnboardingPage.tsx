import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDependencies } from '../app/dependencies';
import { useAppState } from '../app/appState';
import { COMPANION_MESSAGES, DEFAULT_LOOK } from '@domain/companion';
import { Button } from '../components/Button';
import {
  CalendarIcon,
  LeafIcon,
  LockIcon,
  PersonIcon,
  SmileIcon,
  TargetIcon,
} from '../components/icons';
import { APP_NAME } from '../components/Page';
import { ScrollArea } from '../components/ScrollArea';
import { useToast } from '../components/Toast';
import { Nutry } from '../features/companion/Nutry';
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
  aboutIssuesFrom,
} from '../features/profile/draft';
import type { AboutIssues, ProfileDraft } from '../features/profile/draft';
import styles from './OnboardingPage.module.css';

interface Step {
  readonly title: string;
  readonly intro: string;
  readonly icon: ReactNode;
  /** Écran facultatif : bouton « Passer ». */
  readonly optional: boolean;
}

const FIRST_STEP: Step = {
  title: 'Faisons connaissance',
  intro: 'Pour ajuster tes portions. Tout reste sur ton téléphone.',
  icon: <PersonIcon size={26} />,
  optional: false,
};

const STEPS: readonly Step[] = [
  FIRST_STEP,
  {
    title: 'Ton objectif',
    intro: 'Et ce que tu ne manges pas.',
    icon: <TargetIcon size={26} />,
    optional: true,
  },
  {
    title: 'Tes goûts',
    intro: 'Touche ce que tu adores… et ce que tu évites.',
    icon: <SmileIcon size={26} />,
    optional: true,
  },
  {
    title: 'Ton organisation',
    intro: 'Pour un menu qui tient dans ta semaine.',
    icon: <CalendarIcon size={26} />,
    optional: true,
  },
];

export function OnboardingPage() {
  const { previewProfile, saveProfile, requestPersistentStorage, getCurrentPlan, markQuizShown } =
    useDependencies();
  const { setProfileStatus } = useAppState();
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(DEFAULT_DRAFT);
  const [showIssues, setShowIssues] = useState(false);
  const [savedIssues, setSavedIssues] = useState<AboutIssues>({});
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
    // Nouvel écran : on annonce son titre (la zone défilante est remontée par sa clé).
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
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
      const result = await saveProfile(profile);
      if (result.status === 'invalid') {
        setSavedIssues(aboutIssuesFrom(result.issues));
        setShowIssues(true);
        setStep(0);
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
          <LeafIcon size={18} />
          {APP_NAME}
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
          {step + 1}/{STEPS.length}
          <span className="visually-hidden">
            {' '}
            Étape {step + 1} sur {STEPS.length}
          </span>
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
          {step === 0 ? (
            <Nutry look={DEFAULT_LOOK} mood="joyeux" size="m" />
          ) : (
            <span className={styles.icon}>{current.icon}</span>
          )}
          <div className={styles.headerText}>
            <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
              {current.title}
            </h1>
            <p className={styles.intro}>
              {step === 0 ? COMPANION_MESSAGES.welcome : current.intro}
            </p>
            {step === 0 && <p className={styles.introSub}>{current.intro}</p>}
          </div>
        </header>

        <ScrollArea key={step} label={current.title} className={styles.body}>
          {step === 0 && (
            <AboutSection
              draft={draft}
              onChange={update}
              issues={showIssues ? { ...savedIssues, ...issues } : {}}
            />
          )}
          {step === 1 && <GoalSection draft={draft} onChange={update} health={health} />}
          {step === 2 && <TastesSection draft={draft} onChange={update} />}
          {step === 3 && <OrganisationSection draft={draft} onChange={update} />}
          {step === 0 && (
            <p className={styles.privacy}>
              <LockIcon size={16} />
              Aucun compte, aucun serveur. <Link to="/confidentialite">Confidentialité</Link>
            </p>
          )}
        </ScrollArea>

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
      </form>
    </div>
  );
}
