import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { panelId, tabId } from './tabIds';
import styles from './SegmentedTabs.module.css';

export interface TabItem<T extends string> {
  readonly id: T;
  readonly label: ReactNode;
  /** Nom complet lu par les lecteurs d'écran (sinon le texte du libellé). */
  readonly ariaLabel?: string;
}

interface SegmentedTabsProps<T extends string> {
  /** Nom de la liste d'onglets. */
  readonly label: string;
  readonly tabs: readonly TabItem<T>[];
  readonly value: T;
  readonly onChange: (id: T) => void;
  /** Préfixe des identifiants, partagé avec les panneaux (`tabId`, `panelId`). */
  readonly idPrefix: string;
  /** `segmented` : trois onglets d'un bloc ; `chips` : puces défilables ; `days` : pastilles de jours. */
  readonly variant?: 'segmented' | 'chips' | 'days';
  /** Faux si les onglets ne pilotent pas un panneau précis (bandeau de jours). */
  readonly controlsPanel?: boolean;
  readonly className?: string | undefined;
}

/**
 * Onglets accessibles (rôle tablist) : un seul onglet dans l'ordre de tabulation, flèches
 * gauche/droite, Début/Fin ; l'onglet actif porte `aria-selected`. Le panneau associé
 * (`role="tabpanel"`, `id={panelId(...)}`) est fourni par l'appelant.
 */
export function SegmentedTabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  idPrefix,
  variant = 'segmented',
  controlsPanel = true,
  className,
}: SegmentedTabsProps<T>) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const select = (index: number) => {
    const target = tabs[(index + tabs.length) % tabs.length];
    if (!target) return;
    onChange(target.id);
    const node = refs.current.get(target.id);
    node?.focus();
    // `scrollIntoView` est absent de jsdom (tests).
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- absent de jsdom
    node?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight') select(index + 1);
    else if (event.key === 'ArrowLeft') select(index - 1);
    else if (event.key === 'Home') select(0);
    else if (event.key === 'End') select(tabs.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={[styles.list, styles[variant], className ?? ''].filter(Boolean).join(' ')}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) refs.current.set(tab.id, node);
              else refs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={controlsPanel ? panelId(idPrefix, tab.id) : undefined}
            aria-label={tab.ariaLabel}
            tabIndex={selected ? 0 : -1}
            className={`${styles.tab} ${selected ? styles.selected : ''}`}
            onClick={() => {
              onChange(tab.id);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
