import { describe, expect, it } from 'vitest';
import {
  ALWAYS_AVAILABLE_EQUIPMENT,
  EQUIPMENT_BY_SETTING,
  EQUIPMENT_SETTINGS,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  SAFETY_EXCLUDED_TAGS,
  TRAINING_LEVELS,
  type EquipmentSetting,
  type ExerciseTag,
} from '@domain/training';
import exercisesJson from './exercises.json';
import { exerciseCatalogFileSchema, type ExerciseEntry } from './exerciseSchemas';
import { MOVEMENT_KEYS } from './movementKeys';

const parsed = exerciseCatalogFileSchema.safeParse(exercisesJson);
const exercises: readonly ExerciseEntry[] = parsed.success ? parsed.data.exercises : [];
const byId = new Map(exercises.map((e) => [e.id, e]));

/** Toute étiquette qu'au moins un garde-fou santé exclut (grossesse, post-partum, 70 ans…). */
const SAFETY_TAGS = new Set<ExerciseTag>(Object.values(SAFETY_EXCLUDED_TAGS).flat());

const feasible = (entry: ExerciseEntry, setting: EquipmentSetting): boolean => {
  const available = new Set([...EQUIPMENT_BY_SETTING[setting], ...ALWAYS_AVAILABLE_EQUIPMENT]);
  return entry.equipment.every((item) => available.has(item));
};

describe('exercises.json : catalogue embarqué', () => {
  it('respecte le schéma Zod (provenance Nutry, licence MIT)', () => {
    expect(
      parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    ).toEqual([]);
    expect(exercisesJson.source).toEqual({ name: 'nutry', license: 'MIT' });
    for (const entry of exercises) {
      expect(entry.credit.provider).toBe('nutry');
      expect(entry.credit.license).toBe('MIT');
    }
  });

  it('compte de 150 à 200 exercices, d’identifiants uniques', () => {
    expect(exercises.length).toBeGreaterThanOrEqual(150);
    expect(exercises.length).toBeLessThanOrEqual(200);
    expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length);
  });

  it('relie chaque easierId et harderId à un exercice existant du même schéma', () => {
    const problems: string[] = [];
    for (const entry of exercises) {
      for (const key of ['easierId', 'harderId'] as const) {
        const target = entry[key];
        if (target === undefined) continue;
        const variant = byId.get(target);
        if (!variant) problems.push(`${entry.id}.${key} : ${target} introuvable`);
        else if (variant.pattern !== entry.pattern) {
          problems.push(`${entry.id}.${key} : ${target} est d’un autre schéma`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('range les variantes du plus facile au plus difficile (niveau jamais inversé)', () => {
    const rank = (id: string) => TRAINING_LEVELS.indexOf(byId.get(id)?.level ?? 'debutant');
    const problems: string[] = [];
    for (const entry of exercises) {
      if (entry.easierId !== undefined && rank(entry.easierId) > rank(entry.id)) {
        problems.push(`${entry.id} : plus facile (${entry.easierId}) de niveau supérieur`);
      }
      if (entry.harderId !== undefined && rank(entry.harderId) < rank(entry.id)) {
        problems.push(`${entry.id} : plus difficile (${entry.harderId}) de niveau inférieur`);
      }
    }
    expect(problems).toEqual([]);
  });

  describe('couverture : 11 groupes × 3 contextes', () => {
    const cases = MUSCLE_GROUPS.flatMap((group) =>
      EQUIPMENT_SETTINGS.map((setting) => [group, setting] as const),
    );
    it.each(cases)('%s, cadre « %s » : au moins 2 exercices, dont 1 débutant', (group, setting) => {
      const found = exercises.filter(
        (e) => e.primaryMuscles.includes(group) && feasible(e, setting),
      );
      expect(found.length, `${group} / ${setting}`).toBeGreaterThanOrEqual(2);
      expect(
        found.some((e) => e.level === 'debutant'),
        `${group} / ${setting} débutant`,
      ).toBe(true);
    });

    it('compte 33 combinaisons', () => {
      expect(cases).toHaveLength(33);
    });
  });

  describe('exigence du planificateur : un exercice sans matériel ni étiquette de sécurité', () => {
    it.each(MOVEMENT_PATTERNS)('schéma « %s »', (pattern) => {
      const found = exercises.filter(
        (e) =>
          e.pattern === pattern &&
          feasible(e, 'maison') &&
          !e.tags.some((tag) => SAFETY_TAGS.has(tag)),
      );
      expect(found.length, pattern).toBeGreaterThanOrEqual(1);
    });
  });

  it('garde les muscles principaux parcimonieux (un seul par exercice : les autres sont secondaires)', () => {
    const tooMany = exercises
      .filter((e) => e.primaryMuscles.length > 1)
      .map((e) => `${e.id} : ${e.primaryMuscles.join()}`);
    expect(tooMany).toEqual([]);
  });
});

describe('clés de pose des mannequins', () => {
  it('liste des clés sans doublon, en kebab-case', () => {
    expect(new Set(MOVEMENT_KEYS).size).toBe(MOVEMENT_KEYS.length);
    for (const key of MOVEMENT_KEYS) expect(key).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('chaque exercice porte une clé connue', () => {
    const known = new Set<string>(MOVEMENT_KEYS);
    expect(exercises.filter((e) => !known.has(e.movement)).map((e) => e.id)).toEqual([]);
  });

  it('chaque clé sert au moins un exercice (aucune pose orpheline)', () => {
    const used = new Set(exercises.map((e) => e.movement));
    expect(MOVEMENT_KEYS.filter((key) => !used.has(key))).toEqual([]);
  });
});
