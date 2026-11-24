import type { ReactNode } from 'react';

export interface IconProps {
  /** Côté en pixels (24 par défaut). */
  readonly size?: number;
  readonly className?: string | undefined;
}

/**
 * Base des pictogrammes : SVG au trait fin (stroke 1.75, 24 px), couleur héritée du texte,
 * décoratif (`aria-hidden`) : le nom accessible vient toujours du bouton ou du lien.
 */
export function makeIcon(paths: ReactNode) {
  return function Icon({ size = 24, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        className={className}
      >
        {paths}
      </svg>
    );
  };
}
