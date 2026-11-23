import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
import styles from './RoundIconButton.module.css';

type Tone = 'plain' | 'primary' | 'accent' | 'soft';

interface CommonProps {
  /** Pictogramme (emoji), décoratif : le nom accessible est `label`. */
  readonly icon: ReactNode;
  /** Nom complet pour les lecteurs d'écran (commence par la légende visible, s'il y en a une). */
  readonly label: string;
  /** Légende courte sous le bouton. */
  readonly caption?: string | undefined;
  readonly tone?: Tone | undefined;
  /** Pastille d'attention (point de couleur). */
  readonly dot?: boolean | undefined;
}

function wrapClass(caption: string | undefined, className?: string): string {
  return [styles.wrap, caption === undefined ? '' : styles.withCaption, className ?? '']
    .filter(Boolean)
    .join(' ');
}

function Face({ icon, caption, tone = 'plain', dot }: Omit<CommonProps, 'label'>) {
  return (
    <>
      <span className={`${styles.round} ${styles[tone]}`} aria-hidden="true">
        {icon}
        {dot && <span className={styles.dot} />}
      </span>
      {caption !== undefined && (
        <span className={styles.caption} aria-hidden="true">
          {caption}
        </span>
      )}
    </>
  );
}

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>;

/** Bouton rond (≥ 44 px) avec pictogramme, légende facultative et nom accessible explicite. */
export function RoundIconButton({
  icon,
  label,
  caption,
  tone,
  dot,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} aria-label={label} className={wrapClass(caption, className)} {...rest}>
      <Face icon={icon} caption={caption} tone={tone} dot={dot} />
    </button>
  );
}

type LinkButtonProps = CommonProps & Omit<LinkProps, 'children' | 'aria-label'>;

/** Lien de navigation avec l'apparence d'un bouton rond. */
export function RoundIconLink({
  icon,
  label,
  caption,
  tone,
  dot,
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <Link aria-label={label} className={wrapClass(caption, className)} {...rest}>
      <Face icon={icon} caption={caption} tone={tone} dot={dot} />
    </Link>
  );
}
