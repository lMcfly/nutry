import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { ScrollArea } from './ScrollArea';
import styles from './Page.module.css';

// Réexportés pour les écrans et les tests qui les importaient d'ici.
// eslint-disable-next-line react-refresh/only-export-components -- constantes et utilitaire de test
export { APP_NAME, resetPageFocusForTests } from '../hooks/usePageTitle';

interface PageProps {
  readonly title: string;
  /** Titre affiché (sinon `title`). */
  readonly heading?: ReactNode;
  readonly subtitle?: ReactNode;
  /** Lien de retour (bouton rond) pour les sous-écrans. */
  readonly back?: { readonly to: string; readonly label: string };
  /** Actions à droite du titre. */
  readonly actions?: ReactNode;
  /** Le contenu défile à l'intérieur de la page (écrans secondaires uniquement). */
  readonly scroll?: boolean;
  readonly children: ReactNode;
}

/**
 * Gabarit d'écran de la coque d'app : en-tête compact puis contenu qui remplit la hauteur
 * disponible (aucun défilement de page). Titre de l'onglet et focus sur le titre à chaque
 * changement de route.
 */
export function Page({
  title,
  heading,
  subtitle,
  back,
  actions,
  scroll = false,
  children,
}: PageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  usePageTitle(title, headingRef);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {back && (
          <Link to={back.to} className={styles.back} aria-label={`Retour : ${back.label}`}>
            <span aria-hidden="true">←</span>
          </Link>
        )}
        <div className={styles.titles}>
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            {heading ?? title}
          </h1>
          {subtitle !== undefined && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions !== undefined && <div className={styles.actions}>{actions}</div>}
      </header>
      {scroll ? (
        <ScrollArea label={title} className={styles.content}>
          {children}
        </ScrollArea>
      ) : (
        <div className={styles.content}>{children}</div>
      )}
    </div>
  );
}
