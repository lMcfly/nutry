import { describe, expect, it } from 'vitest';
import type { DayIndex } from '../mealplan';
import {
  ALWAYS_AVAILABLE_EQUIPMENT,
  BALANCE_RULES,
  DEFAULT_TRAINING_DAYS,
  EQUIPMENT_BY_SETTING,
  EQUIPMENT_SETTINGS,
  EXERCISE_TAGS,
  HOLD_SECONDS,
  MAX_STRENGTH_SESSIONS,
  MOVEMENT_PATTERNS,
  PATTERN_KIND,
  PATTERN_PRIMARY_GROUPS,
  PREFERRED_EQUIPMENT,
  PULL_PATTERNS,
  PUSH_PATTERNS,
  RECOVERY_EXEMPT_PATTERNS,
  REP_SCHEMES,
  SAFETY_DISCOURAGED_TAGS,
  SAFETY_EXCLUDED_TAGS,
  SESSION_KINDS,
  SESSION_TEMPLATES,
  SETS_BY_ROLE,
  SPLIT_CANDIDATES,
  TRAINING_DISCLAIMER,
  TRAINING_FREQUENCIES,
  TRAINING_GOALS,
  TRAINING_LEVELS,
  TRAINING_SAFETY_MESSAGES,
  chooseSplit,
  cyclicDayGap,
  patternSets,
  sessionsConflict,
  templateHeavyGroups,
  templateSlots,
  type MovementPattern,
  type SessionKind,
  type SplitAssignment,
  type TrainingLevel,
} from '.';

const strengthSessions = (assignment: SplitAssignment) =>
  assignment.sessions.filter((s) => s.kind !== 'douce');

const hasConflict = (assignment: SplitAssignment): boolean => {
  const sessions = strengthSessions(assignment);
  return sessions.some((a, i) => sessions.slice(i + 1).some((b) => sessionsConflict(a, b)));
};

/** Séries par schéma quand chaque séance ne garde que ses `keep` premiers blocs. */
function truncatedSets(
  kinds: readonly SessionKind[],
  level: TrainingLevel,
  keep: number,
): Partial<Record<MovementPattern, number>> {
  const totals: Partial<Record<MovementPattern, number>> = {};
  for (const kind of kinds) {
    const template = SESSION_TEMPLATES[kind];
    const blocks = template.blocks.slice(0, Math.max(keep, template.minBlocks));
    for (const { pattern, role } of blocks.flat()) {
      totals[pattern] = (totals[pattern] ?? 0) + SETS_BY_ROLE[role][level];
    }
  }
  return totals;
}

const sum = (
  sets: Partial<Record<MovementPattern, number>>,
  patterns: readonly MovementPattern[],
) => patterns.reduce((total, pattern) => total + (sets[pattern] ?? 0), 0);

/** Tous les sous-ensembles non vides de jours, jusqu'à 6 jours. */
const ALL_DAY_SETS: DayIndex[][] = Array.from({ length: 127 }, (_, mask) => mask + 1)
  .map((mask) => ([0, 1, 2, 3, 4, 5, 6] as const).filter((d) => (mask >> d) & 1))
  .filter((days) => days.length <= 6);

describe('vocabulaires et barèmes', () => {
  it('associe chaque schéma à une nature et à des groupes cohérents', () => {
    for (const pattern of MOVEMENT_PATTERNS) {
      const groups = PATTERN_PRIMARY_GROUPS[pattern];
      if (PATTERN_KIND[pattern] === 'force' && pattern !== 'gainage') {
        expect(groups.length, pattern).toBeGreaterThan(0);
      }
      if (PATTERN_KIND[pattern] !== 'force') {
        expect(groups, pattern).toEqual([]);
        expect(RECOVERY_EXEMPT_PATTERNS).toContain(pattern);
      }
    }
    expect(PUSH_PATTERNS.some((p) => PULL_PATTERNS.includes(p))).toBe(false);
  });

  it('préconfigure un matériel qui contient toujours le tapis et le matériel préféré', () => {
    for (const setting of EQUIPMENT_SETTINGS) {
      for (const item of ALWAYS_AVAILABLE_EQUIPMENT) {
        expect(EQUIPMENT_BY_SETTING[setting]).toContain(item);
      }
      for (const item of PREFERRED_EQUIPMENT[setting]) {
        expect(EQUIPMENT_BY_SETTING[setting]).toContain(item);
      }
    }
  });

  it('a des fourchettes de répétitions et de durées croissantes', () => {
    for (const goal of TRAINING_GOALS) {
      expect(REP_SCHEMES[goal].minReps).toBeLessThan(REP_SCHEMES[goal].maxReps);
      expect(REP_SCHEMES[goal].restSeconds).toBeGreaterThan(0);
    }
    for (const level of TRAINING_LEVELS) {
      expect(HOLD_SECONDS[level].min).toBeLessThan(HOLD_SECONDS[level].max);
      expect(MAX_STRENGTH_SESSIONS[level]).toBeGreaterThanOrEqual(3);
    }
  });

  it('propose des jours par défaut en nombre égal à la fréquence', () => {
    for (const frequency of TRAINING_FREQUENCIES) {
      expect(new Set(DEFAULT_TRAINING_DAYS[frequency]).size).toBe(frequency);
    }
  });
});

describe('gabarits de séance', () => {
  it('ne propose en séance courte (20 min) que des blocs équilibrés à eux seuls', () => {
    // Poussée = tirage, ou genou = hanche, bloc par bloc : l'équilibre hebdomadaire tient quel que
    // soit le bloc qui reste, séance après séance (le niveau est le même pour toutes).
    for (const kind of SESSION_KINDS) {
      if (kind === 'douce') continue;
      for (const index of SESSION_TEMPLATES[kind].shortBlocks) {
        const patterns = (SESSION_TEMPLATES[kind].blocks[index] ?? []).map((s) => s.pattern);
        const count = (list: readonly string[]) => patterns.filter((p) => list.includes(p)).length;
        const balanced =
          (count(PUSH_PATTERNS) === 1 && count(PULL_PATTERNS) === 1) ||
          (count(['genou']) === 1 && count(['hanche']) === 1) ||
          kind === 'poussee' ||
          kind === 'tirage';
        expect(balanced, `${kind} bloc ${index}`).toBe(true);
      }
    }
  });

  it('décrit chaque type de séance avec des blocs de un ou deux créneaux', () => {
    for (const kind of SESSION_KINDS) {
      const template = SESSION_TEMPLATES[kind];
      expect(template.kind).toBe(kind);
      expect(template.title.length).toBeGreaterThan(0);
      expect(template.minBlocks).toBeGreaterThanOrEqual(1);
      expect(template.minBlocks).toBeLessThanOrEqual(template.blocks.length);
      expect(template.shortBlocks.length).toBeGreaterThanOrEqual(1);
      for (const index of template.shortBlocks) {
        expect(Number.isInteger(index) && index >= 0 && index < template.blocks.length).toBe(true);
      }
      expect(templateSlots(kind).length).toBeGreaterThanOrEqual(template.blocks.length);
    }
  });

  it('commence chaque séance de renforcement par un créneau principal', () => {
    for (const kind of SESSION_KINDS) {
      expect(templateSlots(kind)[0]?.role, kind).toBe('principal');
    }
  });

  it('ne sollicite fortement aucun groupe dans une séance douce', () => {
    expect(templateHeavyGroups('douce')).toEqual([]);
    expect(templateHeavyGroups('haut-a')).not.toContain('quadriceps');
    expect(templateHeavyGroups('bas-a')).not.toContain('pectoraux');
    expect(templateHeavyGroups('poussee')).not.toContain('dos');
    expect(templateHeavyGroups('tirage')).not.toContain('pectoraux');
  });

  it('additionne les séries par schéma', () => {
    const sets = patternSets(['full-a'], 'debutant');
    expect(sets.genou).toBe(3);
    expect(sets['tirage-horizontal']).toBe(3);
    expect(sets['tirage-vertical']).toBe(2);
  });

  describe.each(TRAINING_LEVELS)('équilibres hebdomadaires (%s)', (level) => {
    const splits = Object.values(SPLIT_CANDIDATES).flat();
    it.each(splits.map((s) => [s.split, s.kinds] as const))(
      '%s garde tirage ≥ poussée et genou ≈ hanche, même raccourci',
      (_name, kinds) => {
        for (const keep of [1, 2, 3]) {
          const sets = truncatedSets(kinds, level, keep);
          const push = sum(sets, PUSH_PATTERNS);
          const pull = sum(sets, PULL_PATTERNS);
          expect(pull / push).toBeGreaterThanOrEqual(BALANCE_RULES.pullToPushMin);
          expect(pull / push).toBeLessThanOrEqual(BALANCE_RULES.pullToPushMax);
          const knee = sets.genou ?? 0;
          const hip = sets.hanche ?? 0;
          if (knee + hip > 0) {
            expect(knee / hip).toBeGreaterThanOrEqual(BALANCE_RULES.kneeToHipMin);
            expect(knee / hip).toBeLessThanOrEqual(BALANCE_RULES.kneeToHipMax);
          }
        }
      },
    );
  });
});

describe('règle des 48 h', () => {
  it('mesure l’écart entre jours, semaine suivante comprise', () => {
    expect(cyclicDayGap(0, 6)).toBe(1);
    expect(cyclicDayGap(1, 4)).toBe(3);
    expect(cyclicDayGap(2, 2)).toBe(0);
  });

  it('signale deux séances rapprochées sur les mêmes groupes, pas sur des groupes différents', () => {
    expect(sessionsConflict({ dayIndex: 0, kind: 'full-a' }, { dayIndex: 1, kind: 'full-b' })).toBe(
      true,
    );
    expect(sessionsConflict({ dayIndex: 0, kind: 'haut-a' }, { dayIndex: 1, kind: 'bas-a' })).toBe(
      false,
    );
    expect(sessionsConflict({ dayIndex: 0, kind: 'full-a' }, { dayIndex: 2, kind: 'full-b' })).toBe(
      false,
    );
    expect(sessionsConflict({ dayIndex: 6, kind: 'jambes' }, { dayIndex: 0, kind: 'bas-b' })).toBe(
      true,
    );
  });
});

describe('chooseSplit', () => {
  it.each([
    [1, 'full-body'],
    [2, 'full-body'],
    [3, 'full-body'],
    [4, 'haut-bas'],
    [5, 'ppl-haut-bas'],
    [6, 'ppl'],
  ] as const)('%i jours par défaut : %s, sans conflit ni séance douce', (frequency, split) => {
    const assignment = chooseSplit(DEFAULT_TRAINING_DAYS[frequency], 6);
    expect(assignment.split).toBe(split);
    expect(assignment.sessions.map((s) => s.dayIndex)).toEqual(DEFAULT_TRAINING_DAYS[frequency]);
    expect(assignment.sessions.every((s) => s.kind !== 'douce')).toBe(true);
    expect(assignment.capped).toBe(false);
    expect(assignment.tooClose).toBe(false);
    expect(hasConflict(assignment)).toBe(false);
  });

  it('passe en haut/bas quand deux jours se suivent', () => {
    const assignment = chooseSplit([5, 6], 6);
    expect(assignment.split).toBe('haut-bas');
    expect(hasConflict(assignment)).toBe(false);
  });

  it('plafonne les séances de renforcement et complète par des séances douces', () => {
    const assignment = chooseSplit(DEFAULT_TRAINING_DAYS[5], MAX_STRENGTH_SESSIONS.debutant);
    expect(assignment.capped).toBe(true);
    expect(strengthSessions(assignment)).toHaveLength(4);
    expect(assignment.sessions).toHaveLength(5);
    expect(hasConflict(assignment)).toBe(false);
  });

  it('remplace par une séance douce ce qui ne peut pas respecter 48 h', () => {
    const assignment = chooseSplit([0, 1, 2], 6);
    expect(assignment.tooClose).toBe(true);
    expect(assignment.sessions.map((s) => s.kind)).toEqual(['full-a', 'douce', 'full-c']);
    expect(hasConflict(assignment)).toBe(false);
  });

  it('trie, dédoublonne et accepte un plafond nul ou une liste vide', () => {
    expect(chooseSplit([3, 0, 3], 6).sessions.map((s) => s.dayIndex)).toEqual([0, 3]);
    expect(chooseSplit([0, 2], 0).sessions.map((s) => s.kind)).toEqual(['douce', 'douce']);
    expect(chooseSplit([], 6).sessions).toEqual([]);
  });

  it('ne viole jamais la règle des 48 h, quels que soient les jours et le plafond', () => {
    for (const days of ALL_DAY_SETS) {
      for (const cap of [3, 4, 6]) {
        const assignment = chooseSplit(days, cap);
        expect(assignment.sessions).toHaveLength(days.length);
        expect(strengthSessions(assignment).length).toBeLessThanOrEqual(cap);
        expect(hasConflict(assignment), days.join(',')).toBe(false);
        expect(chooseSplit(days, cap)).toEqual(assignment);
      }
    }
  });
});

describe('garde-fous santé : textes et exclusions', () => {
  const texts = [
    TRAINING_DISCLAIMER,
    ...Object.values(TRAINING_SAFETY_MESSAGES).map((m) => m.text),
  ];

  it('ne parle ni de calories ni de poids à perdre', () => {
    for (const text of texts) expect(text).not.toMatch(/calorie|kcal|maigrir|brûl/i);
  });

  it('oriente vers les bons professionnels et les urgences', () => {
    expect(TRAINING_SAFETY_MESSAGES.grossesse.text).toMatch(/sage-femme ou de ton médecin/);
    expect(TRAINING_SAFETY_MESSAGES.urgence.text).toMatch(/15.*112/);
    expect(TRAINING_DISCLAIMER).toMatch(/ne remplace pas un coach ni un médecin/);
    for (const [code, message] of Object.entries(TRAINING_SAFETY_MESSAGES)) {
      expect(message.code).toBe(code);
    }
  });

  it('protège davantage après le premier trimestre et n’utilise que des étiquettes connues', () => {
    for (const tag of SAFETY_EXCLUDED_TAGS.grossessePremierTrimestre) {
      expect(SAFETY_EXCLUDED_TAGS.grossesse).toContain(tag);
    }
    expect(SAFETY_EXCLUDED_TAGS.grossesse).toContain('allonge-dos');
    expect(SAFETY_EXCLUDED_TAGS.senior).toContain('impact');
    const all = [
      ...Object.values(SAFETY_EXCLUDED_TAGS).flat(),
      ...Object.values(SAFETY_DISCOURAGED_TAGS).flat(),
    ];
    for (const tag of all) expect(EXERCISE_TAGS).toContain(tag);
  });
});
