import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { ProfileView, WeightTrackingStatus } from '@application/usecases';
import { MEDICAL_DISCLAIMER } from '@domain/profile';
import { THEMES } from '@domain/userdata';
import type { Theme } from '@domain/userdata';
import { useDependencies } from '../app/dependencies';
import { Button } from '../components/Button';
import { RadioGroup } from '../components/Choice';
import { Notice } from '../components/Notice';
import { Page } from '../components/Page';
import { RoundIconButton } from '../components/RoundIconButton';
import { Sheet } from '../components/Sheet';
import {
  CalendarIcon,
  DatabaseIcon,
  DumbbellIcon,
  FlameIcon,
  HeartIcon,
  InfoIcon,
  LockIcon,
  PaletteIcon,
  PersonIcon,
  SettingsIcon,
  SmileIcon,
  TargetIcon,
} from '../components/icons';
import { ListGroup, ListRow } from '../components/ListRow';
import { useToast } from '../components/Toast';
import { Toggle } from '../components/Toggle';
import { CustomizeSheet } from '../features/companion/CustomizeSheet';
import { Nutry } from '../features/companion/Nutry';
import { useCompanion } from '../features/companion/useCompanion';
import { DataSection } from '../features/data/DataSection';
import { ActivitySuggestionCard } from '../features/training/ActivitySuggestionCard';
import { SportSettingsSheet } from '../features/training/SportSettingsSheet';
import { PrivacyContent } from '../features/privacy/PrivacyContent';
import { ProgressCards } from '../features/progress/ProgressCards';
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
  aboutIssuesFrom,
} from '../features/profile/draft';
import type { AboutIssues, ProfileDraft } from '../features/profile/draft';
import { applyTheme } from '../hooks/theme';
import { useAsync } from '../hooks/useAsync';
import { THEME_LABELS, formatDecimal, plural, unlockPhrase } from '../i18n/labels';
import styles from './MePage.module.css';

export const SAVE_FAILED_MESSAGE = 'Oups, l’enregistrement n’a pas fonctionné. Réessaie.';

interface ProfileData {
  readonly view: ProfileView | undefined;
  readonly theme: Theme;
  readonly tracking: WeightTrackingStatus;
}

type SheetId =
  | 'moi'
  | 'objectif'
  | 'gouts'
  | 'organisation'
  | 'sport'
  | 'apparence'
  | 'donnees'
  | 'confidentialite';

/** Feuilles qui modifient le profil (un seul brouillon, un seul enregistrement). */
const EDITING: readonly SheetId[] = ['moi', 'objectif', 'gouts', 'organisation'];

const SHEET_TITLES: Readonly<Record<SheetId, string>> = {
  moi: 'Moi',
  objectif: 'Objectif et alimentation',
  gouts: 'Goûts',
  organisation: 'Organisation',
  sport: 'Sport',
  apparence: 'Apparence et suivi',
  donnees: 'Mes données',
  confidentialite: 'Confidentialité',
};

export function MePage() {
  const { getProfile, getSettings, getProgressSummary } = useDependencies();
  const load = useCallback(async (): Promise<ProfileData> => {
    const [view, settings, progress] = await Promise.all([
      getProfile(),
      getSettings(),
      getProgressSummary(),
    ]);
    return { view, theme: settings.theme, tracking: progress.weightTracking };
  }, [getProfile, getSettings, getProgressSummary]);
  const { state, setData, reload } = useAsync(load);

  const data = state.status === 'ready' ? state.data : undefined;

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <Page
      title="Moi"
      actions={
        <RoundIconButton
          icon={<SettingsIcon />}
          label="Réglages"
          onClick={() => {
            setSettingsOpen(true);
          }}
        />
      }
    >
      {/* Bandeau permanent (PROMPT §3.2) : affiché même pendant le chargement ou en erreur. */}
      {state.status === 'loading' && (
        <>
          <p role="status" className="visually-hidden">
            Un instant…
          </p>
          {/* Place réservée : la page ne saute pas quand les réponses arrivent. */}
          <div className={styles.skeleton} aria-hidden="true" data-testid="profile-skeleton">
            <div className={styles.skeletonBlock} />
            <div className={styles.skeletonBlock} />
          </div>
        </>
      )}
      {state.status === 'error' && (
        <>
          <Notice tone="danger" emoji={<InfoIcon size={20} />}>
            Ton profil n’a pas pu être chargé.{' '}
            <Button variant="ghost" small onClick={reload}>
              Réessayer
            </Button>
          </Notice>
          <ProgressCards />
        </>
      )}
      {data?.view ? (
        <ProfileContent
          data={data}
          view={data.view}
          settingsOpen={settingsOpen}
          onCloseSettings={() => {
            setSettingsOpen(false);
          }}
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
      ) : (
        <FallbackSettings
          open={settingsOpen}
          onClose={() => {
            setSettingsOpen(false);
          }}
        />
      )}
      <p className={styles.disclaimer} role="note">
        {MEDICAL_DISCLAIMER}
      </p>
    </Page>
  );
}

interface SettingsListProps {
  readonly view: ProfileView | undefined;
  readonly onOpen: (id: SheetId) => void;
}

/** Les réglages : modifier ses réponses, apparence, données, confidentialité. */
function SettingsList({ view, onOpen }: SettingsListProps) {
  return (
    <ListGroup className={styles.list} label="Réglages">
      {view && (
        <>
          <ListRow
            icon={<PersonIcon />}
            title="Moi"
            onClick={() => {
              onOpen('moi');
            }}
          />
          <ListRow
            icon={<TargetIcon />}
            title="Objectif et alimentation"
            onClick={() => {
              onOpen('objectif');
            }}
          />
          <ListRow
            icon={<SmileIcon />}
            title="Goûts"
            onClick={() => {
              onOpen('gouts');
            }}
          />
          <ListRow
            icon={<CalendarIcon />}
            title="Organisation"
            onClick={() => {
              onOpen('organisation');
            }}
          />
          <ListRow
            icon={<DumbbellIcon />}
            title="Sport"
            hint="programme"
            ariaLabel="Sport : mon programme"
            onClick={() => {
              onOpen('sport');
            }}
          />
          <ListRow
            icon={<SettingsIcon />}
            title="Apparence et suivi"
            onClick={() => {
              onOpen('apparence');
            }}
          />
        </>
      )}
      <ListRow
        icon={<DatabaseIcon />}
        title="Mes données"
        onClick={() => {
          onOpen('donnees');
        }}
      />
      <ListRow
        icon={<LockIcon />}
        title="Confidentialité"
        onClick={() => {
          onOpen('confidentialite');
        }}
      />
    </ListGroup>
  );
}

/** Réglages sans profil chargé : seules « Mes données » et « Confidentialité » existent. */
function FallbackSettings({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [sheet, setSheet] = useState<SheetId | undefined>();
  return (
    <>
      <Sheet open={open} title="Réglages" onClose={onClose}>
        <SettingsList
          view={undefined}
          onOpen={(id) => {
            onClose();
            setSheet(id);
          }}
        />
      </Sheet>
      <Sheet
        open={sheet === 'donnees'}
        variant="full"
        title={SHEET_TITLES.donnees}
        onClose={() => {
          setSheet(undefined);
        }}
      >
        <DataSection bare />
      </Sheet>
      <Sheet
        open={sheet === 'confidentialite'}
        variant="full"
        title={SHEET_TITLES.confidentialite}
        onClose={() => {
          setSheet(undefined);
        }}
      >
        <PrivacyContent />
      </Sheet>
    </>
  );
}

interface ProfileContentProps {
  readonly data: ProfileData;
  readonly view: ProfileView;
  readonly settingsOpen: boolean;
  readonly onCloseSettings: () => void;
  readonly onSaved: (view: ProfileView) => void;
  readonly onTheme: (theme: Theme) => void;
  readonly onTracking: (tracking: WeightTrackingStatus) => void;
}

function ProfileContent({
  data,
  view,
  settingsOpen,
  onCloseSettings,
  onSaved,
  onTheme,
  onTracking,
}: ProfileContentProps) {
  const { getProfile, previewProfile, saveProfile, setTheme, setWeightTracking } =
    useDependencies();
  const toast = useToast();
  const location = useLocation();
  const { companion, setCompanion } = useCompanion();
  const [sheet, setSheet] = useState<SheetId | undefined>();
  const [customizing, setCustomizing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
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

  // Lien « Sauvegarder mes données » (pastille de la Semaine) : ouvre directement la feuille.
  useEffect(() => {
    if (location.hash === '#mes-donnees') setSheet('donnees');
  }, [location.hash]);

  const update = (patch: Partial<ProfileDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const closeSheet = () => {
    if (sheet !== undefined && EDITING.includes(sheet) && dirty) {
      // Fermée sans enregistrer : on repart des réponses enregistrées.
      setDraft(draftFromProfile(view.profile));
      setDirty(false);
      setShowIssues(false);
    }
    setSheet(undefined);
  };

  const save = async () => {
    if (!profile) {
      setShowIssues(true);
      setSheet('moi');
      toast.show('Vérifie la section « Moi ».', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await saveProfile(profile);
      if (result.status === 'invalid') {
        setSavedIssues(aboutIssuesFrom(result.issues));
        setShowIssues(true);
        setSheet('moi');
        toast.show('Certaines réponses sont à vérifier.', 'error');
        return;
      }
      setDirty(false);
      // Objectif retenu par l'application (garde-fous) : le formulaire le reflète.
      setDraft((d) => ({ ...d, goal: result.view.profile.goal }));
      onSaved(result.view);
      setSheet(undefined);
      toast.show('C’est enregistré ! Ton menu s’adaptera.', 'success');
    } catch {
      toast.show(SAVE_FAILED_MESSAGE, 'error');
    } finally {
      setSaving(false);
    }
  };

  const e = view.energyDetail;
  const editing = sheet !== undefined && EDITING.includes(sheet);

  const sectionFor = (id: SheetId): ReactNode => {
    switch (id) {
      case 'moi':
        return (
          <>
            <AboutSection
              draft={draft}
              onChange={update}
              issues={showIssues ? { ...savedIssues, ...issues } : {}}
            />
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
      case 'objectif':
        return <GoalSection draft={draft} onChange={update} health={health} />;
      case 'gouts':
        return <TastesSection draft={draft} onChange={update} />;
      case 'organisation':
        return <OrganisationSection draft={draft} onChange={update} />;
      case 'apparence':
        return (
          <div className={styles.appearance}>
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
          </div>
        );
      case 'sport':
        return null;
      case 'donnees':
        return <DataSection bare />;
      case 'confidentialite':
        return <PrivacyContent />;
    }
  };

  return (
    <>
      {shownHealth.messages.length > 0 && (
        <div className={styles.messages}>
          {shownHealth.messages.map((m) => (
            <Notice key={m.code} tone="accent" emoji={<HeartIcon size={20} />}>
              {m.text}
            </Notice>
          ))}
        </div>
      )}

      {/* Changer d'activité recharge la suggestion (le niveau déclaré a bougé). */}
      <ActivitySuggestionCard
        key={view.profile.activity}
        onVisibleChange={setSuggesting}
        onAccepted={() => {
          void getProfile().then((next) => {
            if (next) onSaved(next);
          });
        }}
      />

      <div className={`${styles.layout} ${suggesting ? styles.compact : ''}`}>
        {companion && (
          <section className={styles.hero} aria-label="Nutry">
            <button
              type="button"
              className={styles.heroNutry}
              aria-label="Personnaliser Nutry"
              onClick={() => {
                setCustomizing(true);
              }}
            >
              <Nutry look={companion.look} mood={companion.mood} size="l" />
              <span className={styles.customizeHint} aria-hidden="true">
                <PaletteIcon size={16} />
                Personnaliser
              </span>
            </button>
            <div className={styles.heroText}>
              <p className={styles.streak}>
                <FlameIcon size={20} />
                {companion.streak > 0
                  ? `${plural(companion.streak, 'jour')} de suite`
                  : 'Pas de série en cours'}
                {companion.best > 0 && ` · record : ${companion.best}`}
              </p>
              <p className={styles.message}>{companion.message}</p>
              <p className={styles.next}>
                {companion.nextUnlock
                  ? `Encore ${plural(companion.nextUnlock.inDays, 'jour')} pour ${unlockPhrase(companion.nextUnlock.item)} !`
                  : 'Tu as tout débloqué, bravo !'}
              </p>
            </div>
          </section>
        )}

        <div className={styles.progress}>
          <ProgressCards />
        </div>
      </div>

      <Sheet open={settingsOpen} title="Réglages" onClose={onCloseSettings}>
        <SettingsList
          view={view}
          onOpen={(id) => {
            onCloseSettings();
            setSheet(id);
          }}
        />
      </Sheet>

      <SportSettingsSheet
        open={sheet === 'sport'}
        onClose={() => {
          setSheet(undefined);
        }}
      />

      <Sheet
        open={sheet !== undefined && sheet !== 'sport'}
        variant="full"
        title={sheet ? SHEET_TITLES[sheet] : ''}
        onClose={closeSheet}
        footer={
          editing ? (
            <Button
              block
              disabled={!dirty || saving}
              onClick={() => {
                void save();
              }}
            >
              {dirty ? 'Enregistrer mes réponses' : 'Réponses enregistrées ✓'}
            </Button>
          ) : undefined
        }
      >
        {sheet && sectionFor(sheet)}
      </Sheet>

      {companion && (
        <CustomizeSheet
          open={customizing}
          companion={companion}
          onClose={() => {
            setCustomizing(false);
          }}
          onSaved={setCompanion}
        />
      )}
    </>
  );
}
