import type { ColorId } from '@domain/companion';

/** Teinte d'un Nutry : dégradé de la boule (clair → moyen → foncé) et couleur des joues. */
export interface NutryTint {
  readonly light: string;
  readonly mid: string;
  readonly dark: string;
  readonly cheek: string;
  /** Teinte spéciale : dégradé linéaire multi-couleurs au lieu du dégradé radial. */
  readonly special?: 'aurore' | 'cosmos' | 'arc-en-ciel';
}

/** Couleurs de Nutry (illustration décorative : le texte n'est jamais posé dessus). */
export const NUTRY_TINTS: Readonly<Record<ColorId, NutryTint>> = {
  menthe: { light: '#d4f6df', mid: '#86d9a6', dark: '#4fb77a', cheek: '#ff9bb0' },
  abricot: { light: '#ffe6c8', mid: '#ffba7d', dark: '#f09445', cheek: '#ff8fa3' },
  myrtille: { light: '#dcdeff', mid: '#9499f2', dark: '#6166d0', cheek: '#ff9bc0' },
  citron: { light: '#fff8bd', mid: '#ffdc48', dark: '#e8b800', cheek: '#ff9b8a' },
  framboise: { light: '#ffd9e4', mid: '#ff86aa', dark: '#e24b80', cheek: '#ffb0c2' },
  ciel: { light: '#daf0ff', mid: '#88cbf6', dark: '#4fa3dc', cheek: '#ff9bb0' },
  aurore: {
    light: '#ffd1e0',
    mid: '#ffb87d',
    dark: '#b98cff',
    cheek: '#ff8fa3',
    special: 'aurore',
  },
  cosmos: {
    light: '#8b7be0',
    mid: '#4a3da0',
    dark: '#241a5e',
    cheek: '#ff8fb8',
    special: 'cosmos',
  },
  'arc-en-ciel': {
    light: '#ffe0e0',
    mid: '#ffd36b',
    dark: '#7ec8ff',
    cheek: '#ff8fa3',
    special: 'arc-en-ciel',
  },
};

/** Arrêts des dégradés spéciaux (du haut gauche au bas droit). */
export const SPECIAL_STOPS: Readonly<
  Record<'aurore' | 'cosmos' | 'arc-en-ciel', readonly string[]>
> = {
  aurore: ['#ff9fc0', '#ffb87d', '#ffe08a', '#b98cff'],
  cosmos: ['#6a56d6', '#3a2d88', '#1c1450'],
  'arc-en-ciel': ['#ff8a8a', '#ffc46b', '#ffee70', '#7fdc9a', '#6cc0ff', '#b595ff'],
};
