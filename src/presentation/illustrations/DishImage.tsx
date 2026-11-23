import { useState } from 'react';
import { DishIllustration } from './DishIllustration';
import type { DishSubject } from './match';
import styles from './DishImage.module.css';

interface DishImageProps {
  /** Recette (pour choisir l'illustration de repli). */
  readonly recipe?: DishSubject | undefined;
  /** Photo du plat, servie par le dépôt (même origine : la CSP reste `img-src 'self'`). */
  readonly src?: string | undefined;
  /** Texte alternatif de la photo (l'illustration de repli reste décorative). */
  readonly alt?: string | undefined;
  /** Rapport largeur / hauteur fixe, réservé avant le chargement (évite tout décalage). */
  readonly ratio?: string | undefined;
  /** Image principale visible dès l'ouverture : chargée tout de suite (sinon `lazy`). */
  readonly priority?: boolean | undefined;
  /** Remplit la hauteur que lui laisse son conteneur (pas de ratio) : une hauteur minimale la réserve. */
  readonly fill?: boolean | undefined;
  /** Dégradé léger en bas de l'image, pour du texte posé dessus. */
  readonly scrim?: boolean | undefined;
  readonly className?: string | undefined;
}

/**
 * Image d'un plat : photo si `src` est fournie, sinon (ou si elle ne charge pas, par
 * exemple hors ligne) l'illustration maison. Cadrage `cover`, coins arrondis, ratio fixe.
 */
export function DishImage({
  recipe,
  src,
  alt = '',
  ratio = '4 / 3',
  priority = false,
  scrim = false,
  fill = false,
  className,
}: DishImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  const showPhoto = src !== undefined && src !== failedSrc;
  return (
    <div
      className={[styles.frame, fill ? styles.fill : '', className ?? ''].filter(Boolean).join(' ')}
      style={fill ? undefined : { aspectRatio: ratio }}
      data-photo={showPhoto ? 'true' : 'false'}
    >
      {showPhoto ? (
        <img
          className={styles.photo}
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => {
            setFailedSrc(src);
          }}
        />
      ) : (
        <DishIllustration recipe={recipe} className={styles.art} />
      )}
      {scrim && <span className={styles.scrim} aria-hidden="true" />}
    </div>
  );
}
