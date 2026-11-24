import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useDependencies } from './dependencies';
import { AppStateContext } from './appState';
import type { ProfileStatus } from './appState';
import { TabBar } from '../components/TabBar';
import type { Tab } from '../components/TabBar';
import { BasketIcon, HomeIcon, PersonIcon, TrendIcon } from '../components/icons';
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
const ProfilePage = lazy(() =>
  import('../pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const ProgressPage = lazy(() =>
  import('../pages/ProgressPage').then((m) => ({ default: m.ProgressPage })),
);
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

const TABS: readonly Tab[] = [
  { to: '/semaine', label: 'Semaine', icon: <HomeIcon /> },
  { to: '/courses', label: 'Courses', icon: <BasketIcon /> },
  { to: '/profil', label: 'Profil', icon: <PersonIcon /> },
  { to: '/progres', label: 'Progrès', icon: <TrendIcon /> },
];

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

function Shell() {
  const { getProfile, getSettings, cachedTheme } = useDependencies();
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
    <div className={styles.shell}>
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
              <Route path="/courses" element={<ShoppingPage />} />
              <Route path="/profil" element={<ProfilePage />} />
              <Route path="/progres" element={<ProgressPage />} />
              <Route path="/frigo" element={<FridgePage />} />
              <Route path="/recette/:id" element={<RecipePage />} />
              <Route path="/confidentialite" element={<PrivacyPage />} />
              <Route path="/credits-photos" element={<PhotoCreditsPage />} />
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
      {ready && <TabBar tabs={TABS} />}
      {ready && <QuizCard />}
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
