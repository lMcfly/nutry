import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { ProfileView, WeightTrackingStatus } from '@application/usecases';
import { THEMES } from '@domain/userdata';
import type { Theme } from '@domain/userdata';
import { useDependencies } from '../app/dependencies';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { RadioGroup } from '../components/Choice';
import { Notice } from '../components/Notice';
import { Page } from '../components/Page';
import { useToast } from '../components/Toast';
import { Toggle } from '../components/Toggle';
import { BackupReminder } from '../features/data/BackupReminder';
import { DataSection } from '../features/data/DataSection';
import {
  AboutSection,
  GoalSection,
  OrganisationSection,
  TastesSection,
} from '../features/profile/ProfileSections';
import {
  aboutIssues,
  draftFromProfile,
  draftToProfile,
  withAllowedGoal,
  aboutIssuesFrom,
} from '../features/profile/draft';
import type { AboutIssues, ProfileDraft } from '../features/profile/draft';
import { applyTheme } from '../hooks/theme';
import { useAsync } from '../hooks/useAsync';
import { THEME_LABELS, formatDecimal } from '../i18n/labels';
import styles from './ProfilePage.module.css';

interface ProfileData {
  readonly view: ProfileView | undefined;
  readonly theme: Theme;
  readonly tracking: WeightTrackingStatus;
}

export function ProfilePage() {
  const { getProfile, getSettings, getProgressSummary } = useDependencies();
  const load = useCallback(async (): Promise<ProfileData> => {
    const [view, settings, progress] = await Promise.all([
      getProfile(),
      getSettings(),
      getProgressSummary(),
    ]);
    return { view, theme: settings.theme, tracking: progress.weightTracking };
  }, [getProfile, getSettings, getProgressSummary]);
  const { state, setData } = useAsync(load);
  const location = useLocation();

  const data = state.status === 'ready' ? state.data : undefined;

  useEffect(() => {
    if (!data || location.hash !== '#mes-donnees') return;
    const target = document.getElementById('mes-donnees');
    target?.scrollIntoView({ block: 'start' });
  }, [data, location.hash]);

  return (
    <Page title="Mon profil" subtitle="Tout se modifie, à tout moment.">
      {data?.view && (
        <p className={styles.disclaimer} role="note">
          <span aria-hidden="true">🩺 </span>
          {data.view.health.disclaimer}
        </p>
      )}
      <BackupReminder />
      {state.status === 'loading' && <p role="status">Un instant…</p>}
      {data?.view && (
        <ProfileContent
          data={data}
          view={data.view}
          onSaved={(view) => {
            setData({ ...data, view });
          }}
          onTheme={(theme) => {
            setData({ ...data, theme });
          }}
          onTracking={(tracking) => {
            setData({ ...data, tracking });
          }}
        />
      )}
      <DataSection />
    </Page>
  );
}

interface ProfileContentProps {
  readonly data: ProfileData;
  readonly view: ProfileView;
  readonly onSaved: (view: ProfileView) => void;
  readonly onTheme: (theme: Theme) => void;
  readonly onTracking: (tracking: WeightTrackingStatus) => void;
}

function ProfileContent({ data, view, onSaved, onTheme, onTracking }: ProfileContentProps) {
  const { previewProfile, saveProfile, setTheme, setWeightTracking } = useDependencies();
  const toast = useToast();
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(view.profile));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [savedIssues, setSavedIssues] = useState<AboutIssues>({});

  const issues = useMemo(() => aboutIssues(draft), [draft]);
  const profile = useMemo(() => draftToProfile(draft), [draft]);
  const health = useMemo(
    () => (profile ? previewProfile(profile).health : undefined),
    [profile, previewProfile],
  );
  const shownHealth = health ?? view.health;

  const update = (patch: Partial<ProfileDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const save = async () => {
    if (!profile) {
      setShowIssues(true);
      toast.show('Vérifie la section « Toi ».', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await saveProfile(withAllowedGoal(profile, health?.lossAllowed ?? true));
      if (result.status === 'invalid') {
        setSavedIssues(aboutIssuesFrom(result.issues));
        setShowIssues(true);
        toast.show('Certaines réponses sont à vérifier.', 'error');
        return;
      }
      setDirty(false);
      onSaved(result.view);
      toast.show('C’est enregistré ! Ton menu s’adaptera.', 'success');
    } finally {
      setSaving(false);
    }
  };

  const e = view.energyDetail;

  return (
    <>
      {shownHealth.messages.length > 0 && (
        <div className={styles.messages}>
          {shownHealth.messages.map((m) => (
            <Notice key={m.code} tone="accent" emoji="💛">
              {m.text}
            </Notice>
          ))}
        </div>
      )}

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <EditableSection title="Toi" emoji="👋" open>
          <AboutSection
            draft={draft}
            onChange={update}
            issues={showIssues ? { ...savedIssues, ...issues } : {}}
          />
        </EditableSection>
        <EditableSection title="Objectif, régime et allergies" emoji="🎯">
          <GoalSection draft={draft} onChange={update} health={health} />
        </EditableSection>
        <EditableSection title="Goûts" emoji="😋">
          <TastesSection draft={draft} onChange={update} />
        </EditableSection>
        <EditableSection title="Organisation" emoji="🗓️">
          <OrganisationSection draft={draft} onChange={update} />
        </EditableSection>
        <div className={styles.saveBar}>
          <Button type="submit" block disabled={!dirty || saving}>
            {dirty ? 'Enregistrer mes réponses' : 'Réponses enregistrées ✓'}
          </Button>
        </div>
      </form>

      <Card as="section" aria-labelledby="display-title" className={styles.card}>
        <h2 id="display-title">
          <span aria-hidden="true">🎨 </span>Affichage et suivi
        </h2>
        <RadioGroup
          legend="Thème"
          layout="segmented"
          options={THEMES.map((t) => ({ value: t, label: THEME_LABELS[t] }))}
          value={data.theme}
          onChange={(theme) => {
            applyTheme(theme);
            onTheme(theme);
            void setTheme(theme);
          }}
        />
        <Toggle
          label="Suivi du poids"
          hint={
            data.tracking.enabledByDefault
              ? 'Une pesée par semaine au plus, dans l’onglet Progrès.'
              : 'Désactivé par défaut pour ton profil : à toi de voir, sans pression.'
          }
          checked={data.tracking.enabled}
          onChange={(enabled) => {
            void setWeightTracking(enabled).then(onTracking);
          }}
        />
      </Card>

      <details className={styles.details}>
        <summary>Mon détail énergétique (optionnel)</summary>
        <p className={styles.small}>
          Des repères chiffrés, à titre indicatif. Ton menu, lui, parle en assiettes.
        </p>
        <dl className={styles.energy}>
          <dt>IMC</dt>
          <dd>{formatDecimal(e.bmi)}</dd>
          {e.waistToHeightRatio !== undefined && (
            <>
              <dt>Tour de taille / taille</dt>
              <dd>{formatDecimal(e.waistToHeightRatio, 2)}</dd>
            </>
          )}
          <dt>Métabolisme de base</dt>
          <dd>{Math.round(e.bmrKcal)} kcal/jour</dd>
          <dt>Besoins estimés</dt>
          <dd>{Math.round(e.needsKcal)} kcal/jour</dd>
          <dt>Repère retenu</dt>
          <dd>
            {Math.round(e.targetKcal)} kcal/jour
            {e.deficitApplied ? ' (léger ajustement)' : ''}
          </dd>
        </dl>
      </details>
    </>
  );
}

interface EditableSectionProps {
  readonly title: string;
  readonly emoji: string;
  readonly open?: boolean;
  readonly children: ReactNode;
}

function EditableSection({ title, emoji, open, children }: EditableSectionProps) {
  return (
    <details className={styles.details} open={open}>
      <summary>
        <span aria-hidden="true">{emoji} </span>
        {title}
      </summary>
      <div className={styles.sectionBody}>{children}</div>
    </details>
  );
}
