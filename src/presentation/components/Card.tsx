import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

export type CardTone = 'default' | 'soft' | 'accent' | 'sunken';

interface CardProps extends HTMLAttributes<HTMLElement> {
  readonly as?: 'section' | 'article' | 'div' | 'li' | 'aside';
  readonly tone?: CardTone;
  readonly children: ReactNode;
}

export function Card({
  as: Tag = 'div',
  tone = 'default',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag className={[styles.card, styles[tone], className ?? ''].join(' ')} {...rest}>
      {children}
    </Tag>
  );
}
