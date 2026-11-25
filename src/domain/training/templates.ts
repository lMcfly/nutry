import type { DayIndex } from '../mealplan';
import {
  MIN_RECOVERY_DAYS,
  PATTERN_PRIMARY_GROUPS,
  RECOVERY_EXEMPT_PATTERNS,
  SETS_BY_ROLE,
  type MovementPattern,
  type MuscleGroup,
  type SessionKind,
  type SlotRole,
  type TrainingLevel,
} from './training.constants';
import type { SessionSlot, SessionTemplate, SplitAssignment, SplitName } from './training.types';

/**
 * Gabarits de séance et choix du split (ADR 0015). Chaque bloc associe poussée et tirage, ou
 * genou et hanche : abandonner les derniers blocs pour tenir la durée garde les équilibres.
 */

const slot = (pattern: MovementPattern, role: SlotRole): SessionSlot => ({ pattern, role });

export const SESSION_TEMPLATES: Readonly<Record<SessionKind, SessionTemplate>> = {
  'full-a': {
    kind: 'full-a',
    title: 'Corps entier A',
    blocks: [
      [slot('genou', 'principal'), slot('hanche', 'secondaire')],
      [slot('poussee-horizontale', 'principal'), slot('tirage-horizontal', 'principal')],
      [slot('tirage-vertical', 'accessoire'), slot('gainage', 'accessoire')],
    ],
    minBlocks: 2,
    shortBlocks: [0, 1],
  },
  'full-b': {
    kind: 'full-b',
    title: 'Corps entier B',
    blocks: [
      [slot('hanche', 'principal'), slot('genou', 'secondaire')],
      [slot('tirage-vertical', 'principal'), slot('poussee-verticale', 'secondaire')],
      [slot('tirage-horizontal', 'accessoire'), slot('gainage', 'accessoire')],
    ],
    minBlocks: 2,
    shortBlocks: [0, 1],
  },
  'full-c': {
    kind: 'full-c',
    title: 'Corps entier C',
    blocks: [
      [slot('genou', 'principal'), slot('hanche', 'secondaire')],
      [slot('tirage-horizontal', 'principal'), slot('poussee-horizontale', 'secondaire')],
      [slot('flexion-coude', 'accessoire'), slot('gainage', 'accessoire')],
    ],
    minBlocks: 2,
    shortBlocks: [0, 1],
  },
  'haut-a': {
    kind: 'haut-a',
    title: 'Haut du corps A',
    blocks: [
      [slot('poussee-horizontale', 'principal'), slot('tirage-horizontal', 'principal')],
      [slot('poussee-verticale', 'secondaire'), slot('tirage-vertical', 'secondaire')],
      [slot('flexion-coude', 'accessoire'), slot('extension-coude', 'accessoire')],
    ],
    minBlocks: 1,
    shortBlocks: [0, 1],
  },
  'haut-b': {
    kind: 'haut-b',
    title: 'Haut du corps B',
    blocks: [
      [slot('tirage-vertical', 'principal'), slot('poussee-verticale', 'principal')],
      [slot('tirage-horizontal', 'secondaire'), slot('poussee-horizontale', 'secondaire')],
      [slot('extension-coude', 'accessoire'), slot('flexion-coude', 'accessoire')],
    ],
    minBlocks: 1,
    shortBlocks: [0, 1],
  },
  'bas-a': {
    kind: 'bas-a',
    title: 'Bas du corps A',
    blocks: [
      [slot('genou', 'principal'), slot('hanche', 'secondaire')],
      [slot('genou', 'secondaire'), slot('hanche', 'secondaire')],
      [slot('mollets', 'accessoire'), slot('gainage', 'accessoire')],
    ],
    minBlocks: 1,
    shortBlocks: [0, 1],
  },
  'bas-b': {
    kind: 'bas-b',
    title: 'Bas du corps B',
    blocks: [
      [slot('hanche', 'principal'), slot('genou', 'secondaire')],
      [slot('hanche', 'secondaire'), slot('genou', 'secondaire')],
      [slot('mollets', 'accessoire'), slot('gainage', 'accessoire')],
    ],
    minBlocks: 1,
    shortBlocks: [0, 1],
  },
  poussee: {
    kind: 'poussee',
    title: 'Poussée',
    blocks: [
      [slot('poussee-horizontale', 'principal'), slot('poussee-verticale', 'secondaire')],
      [slot('poussee-horizontale', 'secondaire'), slot('extension-coude', 'accessoire')],
      [slot('gainage', 'accessoire')],
    ],
    minBlocks: 1,
    shortBlocks: [0],
  },
  tirage: {
    kind: 'tirage',
    title: 'Tirage',
    blocks: [
      [slot('tirage-vertical', 'principal'), slot('tirage-horizontal', 'secondaire')],
      [slot('tirage-horizontal', 'secondaire'), slot('flexion-coude', 'accessoire')],
      [slot('gainage', 'accessoire')],
    ],
    minBlocks: 1,
    shortBlocks: [0],
  },
  jambes: {
    kind: 'jambes',
    title: 'Jambes',
    blocks: [
      [slot('genou', 'principal'), slot('hanche', 'principal')],
      [slot('genou', 'secondaire'), slot('hanche', 'secondaire')],
      [slot('mollets', 'accessoire'), slot('gainage', 'accessoire')],
    ],
    minBlocks: 1,
    shortBlocks: [0, 1],
  },
  douce: {
    kind: 'douce',
    title: 'Séance douce',
    blocks: [
      [slot('cardio', 'principal'), slot('mobilite', 'secondaire')],
      [slot('equilibre', 'secondaire'), slot('mobilite', 'accessoire')],
    ],
    minBlocks: 1,
    shortBlocks: [0, 1],
  },
};

/** Splits candidats par nombre de séances de renforcement, dans l'ordre de préférence. */
export const SPLIT_CANDIDATES: Readonly<
  Record<number, readonly { readonly split: SplitName; readonly kinds: readonly SessionKind[] }[]>
> = {
  1: [{ split: 'full-body', kinds: ['full-a'] }],
  2: [
    { split: 'full-body', kinds: ['full-a', 'full-b'] },
    { split: 'haut-bas', kinds: ['haut-a', 'bas-a'] },
  ],
  3: [
    { split: 'full-body', kinds: ['full-a', 'full-b', 'full-c'] },
    { split: 'haut-bas-full', kinds: ['haut-a', 'bas-a', 'full-c'] },
  ],
  4: [{ split: 'haut-bas', kinds: ['haut-a', 'bas-a', 'haut-b', 'bas-b'] }],
  5: [{ split: 'ppl-haut-bas', kinds: ['poussee', 'tirage', 'jambes', 'haut-b', 'bas-b'] }],
  6: [{ split: 'ppl', kinds: ['poussee', 'tirage', 'jambes', 'poussee', 'tirage', 'jambes'] }],
};

/** Tous les créneaux d'un gabarit, dans l'ordre. */
export function templateSlots(kind: SessionKind): readonly SessionSlot[] {
  return SESSION_TEMPLATES[kind].blocks.flat();
}

/**
 * Groupes qu'une séance de ce type peut solliciter fortement : muscles principaux permis par
 * ses schémas, hors schémas peu fatigants (gainage, cardio, mobilité, équilibre).
 */
export function templateHeavyGroups(kind: SessionKind): readonly MuscleGroup[] {
  const groups = new Set<MuscleGroup>();
  for (const { pattern } of templateSlots(kind)) {
    if (RECOVERY_EXEMPT_PATTERNS.includes(pattern)) continue;
    for (const group of PATTERN_PRIMARY_GROUPS[pattern]) groups.add(group);
  }
  return [...groups];
}

/** Écart en jours entre deux jours de la semaine, la semaine suivante comprise (cyclique). */
export function cyclicDayGap(a: DayIndex, b: DayIndex): number {
  const gap = Math.abs(a - b);
  return Math.min(gap, 7 - gap);
}

/** Vrai si deux séances placées ces jours-là violent la règle des 48 h. */
export function sessionsConflict(
  a: { readonly dayIndex: DayIndex; readonly kind: SessionKind },
  b: { readonly dayIndex: DayIndex; readonly kind: SessionKind },
): boolean {
  if (cyclicDayGap(a.dayIndex, b.dayIndex) >= MIN_RECOVERY_DAYS) return false;
  const heavyB = templateHeavyGroups(b.kind);
  return templateHeavyGroups(a.kind).some((group) => heavyB.includes(group));
}

/** Séries prévues par schéma de mouvement pour une suite de séances (gabarits complets). */
export function patternSets(
  kinds: readonly SessionKind[],
  level: TrainingLevel,
): Readonly<Record<MovementPattern, number>> {
  const totals: Partial<Record<MovementPattern, number>> = {};
  for (const kind of kinds) {
    for (const { pattern, role } of templateSlots(kind)) {
      totals[pattern] = (totals[pattern] ?? 0) + SETS_BY_ROLE[role][level];
    }
  }
  return totals as Readonly<Record<MovementPattern, number>>;
}

type Placed = { readonly dayIndex: DayIndex; readonly kind: SessionKind };

function hasConflict(sessions: readonly Placed[]): boolean {
  return sessions.some((a, i) => sessions.slice(i + 1).some((b) => sessionsConflict(a, b)));
}

/** Sous-ensembles de `size` éléments, dans l'ordre lexicographique des positions. */
function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  const result: T[][] = [];
  items.forEach((item, index) => {
    for (const rest of combinations(items.slice(index + 1), size - 1)) {
      result.push([item, ...rest]);
    }
  });
  return result;
}

/**
 * Choisit le split et place une séance par jour choisi, de façon déterministe :
 * 1. `min(jours, maxStrength)` séances de renforcement ; les autres jours : `douce` (`capped`) ;
 * 2. pour chaque split candidat (ordre de préférence), chaque sous-ensemble de jours (ordre
 *    lexicographique) et chaque rotation de la suite de séances, la première combinaison sans
 *    conflit de récupération l'emporte ;
 * 3. sinon : premier candidat, premiers jours, sans rotation, et chaque séance en conflit avec
 *    une séance déjà gardée devient `douce` (`tooClose`).
 */
export function chooseSplit(days: readonly DayIndex[], maxStrength: number): SplitAssignment {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const strengthCount = Math.max(0, Math.min(sorted.length, maxStrength));
  const capped = strengthCount < sorted.length;
  const candidates = SPLIT_CANDIDATES[strengthCount];
  if (!candidates) {
    return {
      split: 'full-body',
      sessions: sorted.map((dayIndex) => ({ dayIndex, kind: 'douce' })),
      capped,
      tooClose: false,
    };
  }
  const subsets = combinations(sorted, strengthCount);
  const withRest = (strength: readonly Placed[]): Placed[] =>
    sorted.map(
      (dayIndex) =>
        strength.find((s) => s.dayIndex === dayIndex) ?? { dayIndex, kind: 'douce' as const },
    );

  for (const { split, kinds } of candidates) {
    for (const subset of subsets) {
      for (let rotation = 0; rotation < kinds.length; rotation += 1) {
        const placed = subset.map((dayIndex, i) => ({
          dayIndex,
          kind: kinds[(i + rotation) % kinds.length] as SessionKind,
        }));
        if (!hasConflict(placed)) {
          return { split, sessions: withRest(placed), capped, tooClose: false };
        }
      }
    }
  }

  // Aucune combinaison ne respecte 48 h : on garde ce qui peut l'être.
  const [first] = candidates as readonly [(typeof candidates)[number]];
  const [subset] = subsets as [DayIndex[]];
  const kept: Placed[] = [];
  for (const [i, dayIndex] of subset.entries()) {
    const session: Placed = { dayIndex, kind: first.kinds[i] as SessionKind };
    if (!kept.some((other) => sessionsConflict(other, session))) kept.push(session);
  }
  return { split: first.split, sessions: withRest(kept), capped, tooClose: true };
}
