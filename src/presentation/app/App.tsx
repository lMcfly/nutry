import { useEffect, useMemo, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useDependencies } from './dependencies';
import { AppStateContext } from './appState';
import type { ProfileStatus } from './appState';
import { TabBar } from '../components/TabBar';
import type { Tab } from '../components/TabBar';
import { ToastProvider } from '../components/Toast';
import { DailyQuiz } from '../features/quiz/DailyQuiz';
import { applyTheme, cachedTheme } from '../hooks/theme';
import { FridgePage } from '../pages/FridgePage';
import { OnboardingPage } from '../pages/OnboardingPage';
import { PrivacyPage } from '../pages/PrivacyPage';
import { ProfilePage } from '../pages/ProfilePage';
import { ProgressPage } from '../pages/ProgressPage';
import { RecipePage } from '../pages/RecipePage';
import { ShoppingPage } from '../pages/ShoppingPage';
import { WeekPage } from '../pages/WeekPage';
import styles from './App.module.css';

const TABS: readonly Tab[] = [
  { to: '/semaine', label: 'Semaine', emoji: '🥗' },
  { to: '/courses', label: 'Courses', emoji: '🧺' },
  { to: '/profil', label: 'Profil', emoji: '🙂' },
  { to: '/progres', label: 'Progrès', emoji: '🌱' },
];

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
            <p className={styles.loading} role="status">
              <span aria-hidden="true">🥕</span> Un instant…
            </p>
          ) : ready ? (
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
          ) : (
            <Routes>
              <Route path="/bienvenue" element={<OnboardingPage />} />
              <Route path="/confidentialite" element={<PrivacyPage />} />
              <Route path="*" element={<Navigate to="/bienvenue" replace />} />
            </Routes>
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
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </HashRouter>
  );
}
