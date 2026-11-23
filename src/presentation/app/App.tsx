import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useDependencies } from './dependencies';
import { AppStateContext } from './appState';
import type { ProfileStatus } from './appState';
import { TabBar } from '../components/TabBar';
import type { Tab } from '../components/TabBar';
import { ToastProvider } from '../components/Toast';
import { DailyQuiz } from '../features/quiz/DailyQuiz';
import { applyTheme, cachedTheme } from '../hooks/theme';
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

const TABS: readonly Tab[] = [
  { to: '/semaine', label: 'Semaine', emoji: '🥗' },
  { to: '/courses', label: 'Courses', emoji: '🧺' },
  { to: '/profil', label: 'Profil', emoji: '🙂' },
  { to: '/progres', label: 'Progrès', emoji: '🌱' },
];

/** Attente sobre et annoncée (chargement initial ou d'un écran). */
function Loading() {
  return (
    <p className={styles.loading} role="status">
      <span aria-hidden="true">🥕</span> Un instant…
    </p>
  );
}

function focusMain() {
  const main = document.getElementById('contenu');
  main?.focus();
}

function Shell() {
  const { getProfile, getSettings } = useDependencies();
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
  }, [getProfile, getSettings]);

  const state = useMemo(() => ({ profileStatus, setProfileStatus }), [profileStatus]);
  const ready = profileStatus === 'ready';

  return (
    <AppStateContext.Provider value={state}>
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
        <main
          id="contenu"
          tabIndex={-1}
          className={`${styles.main} ${ready ? styles.withTabs : ''}`}
        >
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
                <Route path="*" element={<Navigate to="/semaine" replace />} />
              </Routes>
            </Suspense>
          ) : (
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/bienvenue" element={<OnboardingPage />} />
                <Route path="/confidentialite" element={<PrivacyPage />} />
                <Route path="*" element={<Navigate to="/bienvenue" replace />} />
              </Routes>
            </Suspense>
          )}
        </main>
        {ready && <TabBar tabs={TABS} />}
        {ready && <DailyQuiz />}
      </div>
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
