import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ProfilePage } from '../pages/ProfilePage';
import { ProgressPage } from '../pages/ProgressPage';
import { ShoppingPage } from '../pages/ShoppingPage';
import { WeekPage } from '../pages/WeekPage';
import styles from './App.module.css';

const TABS = [
  { to: '/semaine', label: 'Semaine' },
  { to: '/courses', label: 'Courses' },
  { to: '/profil', label: 'Profil' },
  { to: '/progres', label: 'Progrès' },
] as const;

export function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className={styles.shell}>
        <main className={styles.main}>
          <Routes>
            <Route path="/" element={<Navigate to="/semaine" replace />} />
            <Route path="/semaine" element={<WeekPage />} />
            <Route path="/courses" element={<ShoppingPage />} />
            <Route path="/profil" element={<ProfilePage />} />
            <Route path="/progres" element={<ProgressPage />} />
            <Route path="*" element={<Navigate to="/semaine" replace />} />
          </Routes>
        </main>
        <nav className={styles.tabs} aria-label="Navigation principale">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.active}` : styles.tab
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </HashRouter>
  );
}
