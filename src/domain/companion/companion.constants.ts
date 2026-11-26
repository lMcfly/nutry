import type { CompanionState } from './companion.types';
import type {
  AccessorySlot,
  Unlock,
  Accessory,
  ColorItem,
  CompanionLook,
  CompanionMood,
  EyesItem,
} from './companion.types';

const serie = (days: number): Unlock => ({ kind: 'serie', days });
const seances = (count: number): Unlock => ({ kind: 'seances', count });

/**
 * Catalogue des options de Nutry. `unlockAt` : record de série (en jours ; 0 = disponible
 * d'emblée) ou nombre cumulé de séances terminées pour les accessoires sportifs (ADR 0012, 0015).
 * Valeurs à exposer telles quelles.
 */
export const COMPANION_COLORS: readonly ColorItem[] = [
  { kind: 'color', id: 'menthe', label: 'Menthe', emoji: '🌿', unlockAt: serie(0) },
  { kind: 'color', id: 'abricot', label: 'Abricot', emoji: '🍑', unlockAt: serie(0) },
  { kind: 'color', id: 'myrtille', label: 'Myrtille', emoji: '🫐', unlockAt: serie(0) },
  { kind: 'color', id: 'citron', label: 'Citron', emoji: '🍋', unlockAt: serie(0) },
  { kind: 'color', id: 'framboise', label: 'Framboise', emoji: '🍓', unlockAt: serie(0) },
  { kind: 'color', id: 'ciel', label: 'Ciel', emoji: '☁️', unlockAt: serie(0) },
  { kind: 'color', id: 'aurore', label: 'Aurore', emoji: '🌅', unlockAt: serie(5) },
  { kind: 'color', id: 'cosmos', label: 'Cosmos', emoji: '🌌', unlockAt: serie(15) },
  { kind: 'color', id: 'arc-en-ciel', label: 'Arc-en-ciel', emoji: '🌈', unlockAt: serie(45) },
];

export const COMPANION_EYES: readonly EyesItem[] = [
  { kind: 'eyes', id: 'ronds', label: 'Ronds', emoji: '👀', unlockAt: serie(0) },
  { kind: 'eyes', id: 'rieurs', label: 'Rieurs', emoji: '😊', unlockAt: serie(0) },
  { kind: 'eyes', id: 'brillants', label: 'Brillants', emoji: '✨', unlockAt: serie(0) },
  { kind: 'eyes', id: 'malicieux', label: 'Malicieux', emoji: '😏', unlockAt: serie(0) },
  { kind: 'eyes', id: 'doux', label: 'Doux', emoji: '🥰', unlockAt: serie(0) },
];

export const COMPANION_ACCESSORIES: readonly Accessory[] = [
  {
    kind: 'accessory',
    id: 'feuille',
    slot: 'tete',
    label: 'Feuille sur la tête',
    emoji: '🍃',
    unlockAt: serie(1),
  },
  {
    kind: 'accessory',
    id: 'lunettes-rondes',
    slot: 'visage',
    label: 'Lunettes rondes',
    emoji: '👓',
    unlockAt: serie(3),
  },
  {
    kind: 'accessory',
    id: 'toque-de-chef',
    slot: 'tete',
    label: 'Toque de chef',
    emoji: '👨‍🍳',
    unlockAt: serie(7),
  },
  {
    kind: 'accessory',
    id: 'echarpe',
    slot: 'cou',
    label: 'Écharpe',
    emoji: '🧣',
    unlockAt: serie(10),
  },
  {
    kind: 'accessory',
    id: 'tablier',
    slot: 'corps',
    label: 'Tablier',
    emoji: '🍳',
    unlockAt: serie(14),
  },
  {
    kind: 'accessory',
    id: 'bonnet',
    slot: 'tete',
    label: 'Bonnet',
    emoji: '🧶',
    unlockAt: serie(21),
  },
  {
    kind: 'accessory',
    id: 'couronne-de-fruits',
    slot: 'tete',
    label: 'Couronne de fruits',
    emoji: '👑',
    unlockAt: serie(30),
  },
  // Accessoires sportifs : nombre cumulé de séances terminées (ADR 0015, section 6).
  {
    kind: 'accessory',
    id: 'bandeau',
    slot: 'tete',
    label: 'Bandeau',
    emoji: '🎽',
    unlockAt: seances(1),
  },
  {
    kind: 'accessory',
    id: 'serviette',
    slot: 'cou',
    label: 'Serviette',
    emoji: '🧣',
    unlockAt: seances(5),
  },
  {
    kind: 'accessory',
    id: 'casquette',
    slot: 'tete',
    label: 'Casquette',
    emoji: '🧢',
    unlockAt: seances(10),
  },
  {
    kind: 'accessory',
    id: 'medaille',
    slot: 'cou',
    label: 'Médaille',
    emoji: '🏅',
    unlockAt: seances(20),
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
