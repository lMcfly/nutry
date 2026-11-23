import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

interface CommonProps {
  readonly variant?: ButtonVariant | undefined;
  /** Pleine largeur (mobile). */
  readonly block?: boolean | undefined;
  /** Bouton compact (toujours ≥ 44 px de haut). */
  readonly small?: boolean | undefined;
  /** Emoji ou pictogramme décoratif, masqué aux lecteurs d'écran. */
  readonly icon?: ReactNode;
}

function classes({ variant = 'primary', block, small }: CommonProps, extra?: string): string {
  return [
    styles.button,
    styles[variant],
    block ? styles.block : '',
    small ? styles.small : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant,
  block,
  small,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={classes({ variant, block, small }, className)} {...rest}>
      {icon !== undefined && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

type ButtonLinkProps = CommonProps & LinkProps;

/** Lien de navigation avec l'apparence d'un bouton. */
export function ButtonLink({
  variant,
  block,
  small,
  icon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={classes({ variant, block, small }, className)} {...rest}>
      {icon !== undefined && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </Link>
  );
}
