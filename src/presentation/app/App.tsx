import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useDependencies } from './dependencies';
import { AppStateContext } from './appState';
import type { ProfileStatus } from './appState';
import { TabBar } from '../components/TabBar';
import type { Tab } from '../components/TabBar';
import { BasketIcon, DumbbellIcon, HomeIcon, PersonIcon } from '../components/icons';
import { ToastProvider } from '../components/Toast';
import { CelebrationProvider } from '../features/companion/Celebration';
import { QuizCard } from '../features/quiz/QuizCard';
import { applyTheme } from '../hooks/theme';
import { ShoppingPage } from '../pages/ShoppingPage';
import { WeekPage } from '../pages/WeekPage';
import styles from './App.module.css';

/*
 * Découpage par route : Semaine et Courses (les plus utilisés) sont dans le paquet
 * initial ; les autres écrans se chargent à la demande (et sont précachés pour le
 * hors-ligne par le service worker).
 */
const OnboardingPage = lazy(() =>
  import('../pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
);
const MePage = lazy(() => import('../pages/MePage').then((m) => ({ default: m.MePage })));
const FridgePage = lazy(() =>
  import('../pages/FridgePage').then((m) => ({ default: m.FridgePage })),
);
const RecipePage = lazy(() =>
  import('../pages/RecipePage').then((m) => ({ default: m.RecipePage })),
);
const PrivacyPage = lazy(() =>
  import('../pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })),
);

const PhotoCreditsPage = lazy(() =>
  import('../pages/PhotoCreditsPage').then((m) => ({ default: m.PhotoCreditsPage })),
);
// Sport (ADR 0015) : mannequins et fiches d'exercices chargés seulement à la demande.
const SportPage = lazy(() => import('../pages/SportPage').then((m) => ({ default: m.SportPage })));
const SportOnboardingPage = lazy(() =>
  import('../pages/SportOnboardingPage').then((m) => ({ default: m.SportOnboardingPage })),
);
const SessionPage = lazy(() =>
  import('../pages/SessionPage').then((m) => ({ default: m.SessionPage })),
);
const ExerciseCreditsPage = lazy(() =>
  import('../pages/ExerciseCreditsPage').then((m) => ({ default: m.ExerciseCreditsPage })),
);

const TABS: readonly Tab[] = [
  { to: '/semaine', label: 'Semaine', icon: <HomeIcon /> },
  { to: '/sport', label: 'Sport', icon: <DumbbellIcon /> },
  { to: '/courses', label: 'Courses', icon: <BasketIcon /> },
  { to: '/moi', label: 'Moi', icon: <PersonIcon /> },
];

/** Redirige l'ancienne adresse (Profil, Progrès) vers « Moi » en gardant l'ancre (#mes-donnees). */
function RedirectToMe() {
  const { hash } = useLocation();
  return <Navigate to={{ pathname: '/moi', hash }} replace />;
}

/** Attente sobre et annoncée (chargement initial ou d'un écran). */
function Loading() {
  return (
    <p className={styles.loading} role="status">
      Un instant…
    </p>
  );
}

function focusMain() {
  const main = document.getElementById('contenu');
  main?.focus();
}

/**
 * Séance en cours et onboarding Sport : mode concentré, sans barre d'onglets ni question du
 * moment (un bouton de retour ramène à l'onglet Sport).
 */
const FOCUS_ROUTE = /^\/sport\/(seance\/|bienvenue)/;

function Shell() {
  const { getProfile, getSettings, cachedTheme } = useDependencies();
  const { pathname } = useLocation();
  const focus = FOCUS_ROUTE.test(pathname);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('loading');

  useEffect(() => {
    let active = true;
    const cached = cachedTheme();
    if (cached) applyTheme(cached);
    void getSettings().then((settings) => {
      if (active) applyTheme(settings.theme);
    });
    void getProfile().then(
      (view) => {
        if (active) setProfileStatus(view ? 'ready' : 'none');
      },
      () => {
        if (active) setProfileStatus('none');
      },
    );
    return () => {
      active = false;
    };
  }, [getProfile, getSettings, cachedTheme]);

  const state = useMemo(() => ({ profileStatus, setProfileStatus }), [profileStatus]);
  const ready = profileStatus === 'ready';

  const shell = (
    <div className={focus ? `${styles.shell} ${styles.focus}` : styles.shell}>
      <a
        href="#contenu"
        className={styles.skip}
        onClick={(event) => {
          // HashRouter : on ne touche pas au hash, on déplace seulement le focus.
          event.preventDefault();
          focusMain();
        }}
      >
        Aller au contenu
      </a>
      <main id="contenu" tabIndex={-1} className={styles.main}>
        {profileStatus === 'loading' ? (
          <Loading />
        ) : ready ? (
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Navigate to="/semaine" replace />} />
              <Route path="/semaine" element={<WeekPage />} />
              <Route path="/sport" element={<SportPage />} />
              <Route path="/sport/bienvenue" element={<SportOnboardingPage />} />
              <Route path="/sport/seance/:weekStart/:sessionId" element={<SessionPage />} />
              <Route path="/courses" element={<ShoppingPage />} />
              <Route path="/moi" element={<MePage />} />
              {/* Anciens liens : Profil et Progrès sont réunis dans « Moi » (ADR 0013). */}
              <Route path="/profil" element={<RedirectToMe />} />
              <Route path="/progres" element={<RedirectToMe />} />
              <Route path="/frigo" element={<FridgePage />} />
              <Route path="/recette/:id" element={<RecipePage />} />
              <Route path="/confidentialite" element={<PrivacyPage />} />
              <Route path="/credits-photos" element={<PhotoCreditsPage />} />
              <Route path="/credits-exercices" element={<ExerciseCreditsPage />} />
              <Route path="*" element={<Navigate to="/semaine" replace />} />
            </Routes>
          </Suspense>
        ) : (
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/bienvenue" element={<OnboardingPage />} />
              <Route path="/confidentialite" element={<PrivacyPage />} />
              <Route path="/credits-photos" element={<PhotoCreditsPage />} />
              <Route path="*" element={<Navigate to="/bienvenue" replace />} />
            </Routes>
          </Suspense>
        )}
      </main>
      {ready && !focus && <TabBar tabs={TABS} />}
      {ready && !focus && <QuizCard />}
    </div>
  );

  return (
    <AppStateContext.Provider value={state}>
      {ready ? <CelebrationProvider>{shell}</CelebrationProvider> : shell}
    </AppStateContext.Provider>
  );
}

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </HashRouter>
  );
}
