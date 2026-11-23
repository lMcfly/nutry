import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Page.module.css';

export const APP_NAME = 'Nutry';

/** Premier affichage de l'app : on ne vole pas le focus, on le déplace ensuite. */
let firstPageShown = false;

/** Pour les tests : réinitialise le comportement « premier affichage ». */
// eslint-disable-next-line react-refresh/only-export-components -- utilitaire de test
export function resetPageFocusForTests(): void {
  firstPageShown = false;
}

interface PageProps {
  readonly title: string;
  /** Titre affiché (sinon `title`). */
  readonly heading?: ReactNode;
  readonly subtitle?: ReactNode;
  /** Lien de retour pour les sous-écrans. */
  readonly back?: { readonly to: string; readonly label: string };
  /** Actions à droite du titre. */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

/**
 * Gabarit d'écran : titre de l'onglet (`document.title`) et, au changement de route,
 * focus sur le titre principal pour que les lecteurs d'écran annoncent la page.
 */
export function Page({ title, heading, subtitle, back, actions, children }: PageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);

  useEffect(() => {
    if (firstPageShown) headingRef.current?.focus({ preventScroll: false });
    firstPageShown = true;
  }, []);

  return (
    <div className={styles.page}>
      {back && (
        <Link to={back.to} className={styles.back}>
          <span aria-hidden="true">←</span> {back.label}
        </Link>
      )}
      <header className={styles.header}>
        <div className={styles.titles}>
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            {heading ?? title}
          </h1>
          {subtitle !== undefined && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions !== undefined && <div className={styles.actions}>{actions}</div>}
      </header>
      {children}
    </div>
  );
}
