import type { CompanionState } from './companion.types';
import type {
  AccessorySlot,
  Accessory,
  ColorItem,
  CompanionLook,
  CompanionMood,
  EyesItem,
} from './companion.types';

/**
 * Catalogue des options de Nutry. `unlockAt` = record de série (en jours) qui débloque
 * l'élément ; 0 = disponible d'emblée. Valeurs à exposer telles quelles (ADR 0012).
 */
export const COMPANION_COLORS: readonly ColorItem[] = [
  { kind: 'color', id: 'menthe', label: 'Menthe', emoji: '🌿', unlockAt: 0 },
  { kind: 'color', id: 'abricot', label: 'Abricot', emoji: '🍑', unlockAt: 0 },
  { kind: 'color', id: 'myrtille', label: 'Myrtille', emoji: '🫐', unlockAt: 0 },
  { kind: 'color', id: 'citron', label: 'Citron', emoji: '🍋', unlockAt: 0 },
  { kind: 'color', id: 'framboise', label: 'Framboise', emoji: '🍓', unlockAt: 0 },
  { kind: 'color', id: 'ciel', label: 'Ciel', emoji: '☁️', unlockAt: 0 },
  { kind: 'color', id: 'aurore', label: 'Aurore', emoji: '🌅', unlockAt: 5 },
  { kind: 'color', id: 'cosmos', label: 'Cosmos', emoji: '🌌', unlockAt: 15 },
  { kind: 'color', id: 'arc-en-ciel', label: 'Arc-en-ciel', emoji: '🌈', unlockAt: 45 },
];

export const COMPANION_EYES: readonly EyesItem[] = [
  { kind: 'eyes', id: 'ronds', label: 'Ronds', emoji: '👀', unlockAt: 0 },
  { kind: 'eyes', id: 'rieurs', label: 'Rieurs', emoji: '😊', unlockAt: 0 },
  { kind: 'eyes', id: 'brillants', label: 'Brillants', emoji: '✨', unlockAt: 0 },
  { kind: 'eyes', id: 'malicieux', label: 'Malicieux', emoji: '😏', unlockAt: 0 },
  { kind: 'eyes', id: 'doux', label: 'Doux', emoji: '🥰', unlockAt: 0 },
];

export const COMPANION_ACCESSORIES: readonly Accessory[] = [
  {
    kind: 'accessory',
    id: 'feuille',
    slot: 'tete',
    label: 'Feuille sur la tête',
    emoji: '🍃',
    unlockAt: 1,
  },
  {
    kind: 'accessory',
    id: 'lunettes-rondes',
    slot: 'visage',
    label: 'Lunettes rondes',
    emoji: '👓',
    unlockAt: 3,
  },
  {
    kind: 'accessory',
    id: 'toque-de-chef',
    slot: 'tete',
    label: 'Toque de chef',
    emoji: '👨‍🍳',
    unlockAt: 7,
  },
  { kind: 'accessory', id: 'echarpe', slot: 'cou', label: 'Écharpe', emoji: '🧣', unlockAt: 10 },
  { kind: 'accessory', id: 'tablier', slot: 'corps', label: 'Tablier', emoji: '🍳', unlockAt: 14 },
  { kind: 'accessory', id: 'bonnet', slot: 'tete', label: 'Bonnet', emoji: '🧶', unlockAt: 21 },
  {
    kind: 'accessory',
    id: 'couronne-de-fruits',
    slot: 'tete',
    label: 'Couronne de fruits',
    emoji: '👑',
    unlockAt: 30,
  },
];

export const ACCESSORY_SLOT_LABELS: Readonly<Record<AccessorySlot, string>> = {
  tete: 'Tête',
  visage: 'Visage',
  cou: 'Cou',
  corps: 'Corps',
};

export const COMPANION_MOOD_LABELS: Readonly<Record<CompanionMood, string>> = {
  joyeux: 'Joyeux',
  content: 'Content',
  sieste: 'À la sieste',
};

/** Apparence de départ : teinte et yeux de base, sans accessoire. */
export const DEFAULT_LOOK: CompanionLook = { color: 'menthe', eyes: 'ronds', accessories: {} };

export const INITIAL_COMPANION_STATE: CompanionState = {
  look: DEFAULT_LOOK,
  streak: 0,
  best: 0,
  acknowledgedBest: 0,
};

/** Messages courts, bienveillants, au tutoiement (jamais culpabilisants). */
export const COMPANION_MESSAGES = {
  welcome: 'Salut, moi c’est Nutry ! Un petit geste aujourd’hui et on commence ensemble.',
  joyeuxFirst: 'Bravo, on démarre une série ensemble !',
  joyeux: (streak: number): string => `${streak} jours de suite, quel plaisir de te retrouver !`,
  content: 'Coucou ! Un petit geste aujourd’hui pour prolonger notre série ?',
  sieste: (best: number): string =>
    best > 1
      ? `Je faisais une sieste. Content de te revoir ! Ton record de ${best} jours et tes accessoires restent à toi.`
      : 'Je faisais une sieste. Content de te revoir, on repart quand tu veux !',
  locked: 'Cet élément n’est pas encore débloqué, mais ça viendra !',
  unknown: 'Je ne connais pas cet élément.',
} as const;
