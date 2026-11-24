import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './TabBar.module.css';

export interface Tab {
  readonly to: string;
  readonly label: string;
  /** Pictogramme au trait (décoratif). */
  readonly icon: ReactNode;
}

interface TabBarProps {
  readonly tabs: readonly Tab[];
}

/** Barre d'onglets en bas (4 onglets au plus, 3 dans l’app). */
export function TabBar({ tabs }: TabBarProps) {
  return (
    <nav className={styles.tabbar} aria-label="Navigation principale">
      <ul className={styles.list}>
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.active}` : styles.tab
              }
            >
              <span className={styles.icon}>{tab.icon}</span>
              <span className={styles.label}>{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
