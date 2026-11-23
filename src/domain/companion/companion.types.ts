import type { IsoDate } from '../shared';

/** Teintes de base (disponibles d'emblée) puis teintes spéciales (déblocage par série). */
export const COLOR_IDS = [
  'menthe',
  'abricot',
  'myrtille',
  'citron',
  'framboise',
  'ciel',
  'aurore',
  'cosmos',
  'arc-en-ciel',
] as const;
export type ColorId = (typeof COLOR_IDS)[number];

/** Styles d'yeux : tous disponibles d'emblée. */
export const EYE_IDS = ['ronds', 'rieurs', 'brillants', 'malicieux', 'doux'] as const;
export type EyeId = (typeof EYE_IDS)[number];

/** Emplacements d'accessoires : un seul accessoire par emplacement. */
export const ACCESSORY_SLOTS = ['tete', 'visage', 'cou', 'corps'] as const;
export type AccessorySlot = (typeof ACCESSORY_SLOTS)[number];

/** Identifiants d'accessoires par emplacement (dérivent les schémas Zod, ADR 0005). */
export const HEAD_ACCESSORY_IDS = [
  'feuille',
  'toque-de-chef',
  'bonnet',
  'couronne-de-fruits',
] as const;
export const FACE_ACCESSORY_IDS = ['lunettes-rondes'] as const;
export const NECK_ACCESSORY_IDS = ['echarpe'] as const;
export const BODY_ACCESSORY_IDS = ['tablier'] as const;

export const ACCESSORY_IDS = [
  ...HEAD_ACCESSORY_IDS,
  ...FACE_ACCESSORY_IDS,
  ...NECK_ACCESSORY_IDS,
  ...BODY_ACCESSORY_IDS,
] as const;
export type AccessoryId = (typeof ACCESSORY_IDS)[number];

/** Accessoires portés : au plus un par emplacement, du bon emplacement (garanti par le type). */
export interface CompanionAccessories {
  readonly tete?: (typeof HEAD_ACCESSORY_IDS)[number];
  readonly visage?: (typeof FACE_ACCESSORY_IDS)[number];
  readonly cou?: (typeof NECK_ACCESSORY_IDS)[number];
  readonly corps?: (typeof BODY_ACCESSORY_IDS)[number];
}

/** Apparence de Nutry. */
export interface CompanionLook {
  readonly color: ColorId;
  readonly eyes: EyeId;
  readonly accessories: CompanionAccessories;
}

/** Humeur affichée : jamais triste, jamais culpabilisant. */
export const COMPANION_MOODS = ['joyeux', 'content', 'sieste'] as const;
export type CompanionMood = (typeof COMPANION_MOODS)[number];

/** Élément du catalogue. `unlockAt` : record de série (jours) qui le débloque, 0 = d'emblée. */
interface ItemBase {
  readonly label: string;
  readonly emoji: string;
  readonly unlockAt: number;
}
export interface ColorItem extends ItemBase {
  readonly kind: 'color';
  readonly id: ColorId;
}
export interface EyesItem extends ItemBase {
  readonly kind: 'eyes';
  readonly id: EyeId;
}
export interface Accessory extends ItemBase {
  readonly kind: 'accessory';
  readonly id: AccessoryId;
  readonly slot: AccessorySlot;
}
export type CompanionItem = ColorItem | EyesItem | Accessory;

/** État persisté du compagnon : apparence et série (jours actifs consécutifs). */
export interface CompanionState {
  readonly look: CompanionLook;
  /** Dernier jour (local) où la personne a fait un geste ; absent avant le premier. */
  readonly lastActiveDay?: IsoDate;
  /** Série en cours à `lastActiveDay` (0 tant qu'aucun geste). */
  readonly streak: number;
  /** Record de série : base des déblocages (rien ne se reperd). */
  readonly best: number;
  /** Record déjà célébré : les déblocages au-delà sont « nouveaux » jusqu'à acquittement. */
  readonly acknowledgedBest: number;
}

/** Pourquoi une apparence est refusée. */
export type EquipRefusal =
  | { readonly ok: false; readonly reason: 'locked'; readonly item: CompanionItem }
  | { readonly ok: false; readonly reason: 'unknown'; readonly id: string };

export type EquipResult = { readonly ok: true; readonly state: CompanionState } | EquipRefusal;

/** Prochain déblocage : l'élément et le nombre de jours de série encore nécessaires. */
export interface NextUnlock {
  readonly item: CompanionItem;
  readonly inDays: number;
}
