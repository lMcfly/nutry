import { describe, expect, it } from 'vitest';
import { makeProfile } from '../testing/fixtures';
import { makeTraining } from '../testing/training.fixtures';
import { fixtureExercise } from '../testing/exercises.fixtures';
import {
  TRAINING_SAFETY_MESSAGES,
  assessTrainingSafety,
  excludedTagsOf,
  type ExerciseTag,
} from '.';
import type { Profile } from '../profile';
import type { TrainingProfile } from './training.types';

/** Exclusions attendues, écrites à la main d'après le tableau de l'ADR 0015 (section 5). */
const T1: ExerciseTag[] = [
  'impact',
  'haute-intensite',
  'allonge-ventre',
  'flexion-tronc',
  'instable',
  'charge-axiale',
];
const T2: ExerciseTag[] = [...T1, 'allonge-dos'];
const POST: ExerciseTag[] = ['impact', 'haute-intensite', 'flexion-tronc'];
const CONDITION: ExerciseTag[] = ['impact', 'haute-intensite'];
const SENIOR: ExerciseTag[] = ['impact', 'haute-intensite', 'instable', 'charge-axiale'];
const MINOR: ExerciseTag[] = ['charge-axiale'];

const sorted = (tags: readonly string[]) => [...new Set(tags)].sort();
const assess = (profile: Partial<Profile>, training: Partial<TrainingProfile> = {}) =>
  assessTrainingSafety(makeProfile(profile), makeTraining(training));

describe('assessTrainingSafety : exclusions par situation', () => {
  it.each([
    ['adulte sans particularité', {}, {}, []],
    [
      'grossesse, 1er trimestre',
      { pregnantOrBreastfeeding: true },
      { pregnancyStage: 'premier-trimestre' },
      T1,
    ],
    [
      'grossesse après le 1er trimestre',
      { pregnantOrBreastfeeding: true },
      { pregnancyStage: 'apres-premier-trimestre' },
      T2,
    ],
    [
      'grossesse, étape inconnue : règle la plus protectrice',
      { pregnantOrBreastfeeding: true },
      {},
      T2,
    ],
    ['post-partum', { pregnantOrBreastfeeding: true }, { pregnancyStage: 'post-partum' }, POST],
    ['condition de santé', { healthCondition: true }, {}, CONDITION],
    ['70 ans', { age: 70 }, {}, SENIOR],
    ['moins de 18 ans', { age: 17 }, {}, MINOR],
    ['sexe « autre » enceinte', { sex: 'autre', pregnantOrBreastfeeding: true }, {}, T2],
  ] as const)('%s', (_label, profile, training, expected) => {
    expect(sorted(assess(profile, training).excludedTags)).toEqual(sorted(expected));
  });

  it('cumule les exclusions des situations réunies', () => {
    const minorPregnant = assess(
      { age: 16, pregnantOrBreastfeeding: true },
      { pregnancyStage: 'premier-trimestre' },
    );
    expect(sorted(minorPregnant.excludedTags)).toEqual(sorted(T1));
    const seniorCondition = assess({ age: 75, healthCondition: true });
    expect(sorted(seniorCondition.excludedTags)).toEqual(sorted([...SENIOR, ...CONDITION]));
    const everything = assess(
      { age: 80, healthCondition: true, pregnantOrBreastfeeding: true },
      { pregnancyStage: 'post-partum' },
    );
    expect(sorted(everything.excludedTags)).toEqual(sorted([...POST, ...SENIOR, ...CONDITION]));
  });

  it('ignore la grossesse pour un homme et l’étape quand il n’y a pas de grossesse', () => {
    expect(
      assess({ sex: 'homme', pregnantOrBreastfeeding: true }, { pregnancyStage: 'post-partum' })
        .excludedTags,
    ).toEqual([]);
    expect(
      assess({ pregnantOrBreastfeeding: false }, { pregnancyStage: 'premier-trimestre' })
        .excludedTags,
    ).toEqual([]);
  });
});

describe('assessTrainingSafety : bornes d’âge', () => {
  it('bascule à 70 ans (69 : pas de règle senior, 70 : senior)', () => {
    const at69 = assess({ age: 69 });
    const at70 = assess({ age: 70 });
    expect(at69.includeBalance).toBe(false);
    expect(at69.maxStrengthSessions).toBe(6);
    expect(at70.includeBalance).toBe(true);
    expect(at70.maxStrengthSessions).toBe(3);
    expect(at70.requiresAcknowledgement).toBe(true);
    expect(at70.discouragedTags).toEqual(expect.arrayContaining(['au-sol', 'allonge-ventre']));
    expect(at70.messages.map((m) => m.code)).toContain('senior');
    expect(at69.messages.map((m) => m.code)).not.toContain('senior');
  });

  it('bascule à 18 ans (17 : mineur, 18 : adulte)', () => {
    const at17 = assess({ age: 17 });
    const at18 = assess({ age: 18 });
    expect(at17.minReps).toBe(10);
    expect(at17.excludedTags).toContain('charge-axiale');
    expect(at17.messages.map((m) => m.code)).toContain('mineur');
    expect(at18.minReps).toBe(0);
    expect(at18.excludedTags).toEqual([]);
    expect(at18.messages.map((m) => m.code)).not.toContain('mineur');
  });
});

describe('assessTrainingSafety : intensité, charge, plafond, répétitions', () => {
  it('impose une intensité modérée et aucune progression de charge pour grossesse, post-partum, condition', () => {
    for (const [profile, training] of [
      [{ pregnantOrBreastfeeding: true }, { pregnancyStage: 'premier-trimestre' }],
      [{ pregnantOrBreastfeeding: true }, {}],
      [{ pregnantOrBreastfeeding: true }, { pregnancyStage: 'post-partum' }],
      [{ healthCondition: true }, {}],
    ] as const) {
      const safety = assess(profile, training);
      expect(safety.intensity).toBe('moderee');
      expect(safety.loadProgression).toBe(false);
      expect(safety.minReps).toBe(10);
    }
    for (const profile of [{}, { age: 75 }, { age: 15 }]) {
      const safety = assess(profile);
      expect(safety.intensity).toBe('normale');
      expect(safety.loadProgression).toBe(true);
    }
  });

  it('plafonne les séances de renforcement : débutant 4, 70 ans et condition de santé 3 (décision validée)', () => {
    expect(assess({}, { level: 'debutant' }).maxStrengthSessions).toBe(4);
    expect(assess({}, { level: 'intermediaire' }).maxStrengthSessions).toBe(6);
    expect(assess({}, { level: 'confirme' }).maxStrengthSessions).toBe(6);
    expect(assess({ healthCondition: true }, { level: 'confirme' }).maxStrengthSessions).toBe(3);
    expect(assess({ age: 70 }, { level: 'confirme' }).maxStrengthSessions).toBe(3);
    expect(
      assess({ age: 70, healthCondition: true }, { level: 'debutant' }).maxStrengthSessions,
    ).toBe(3);
    expect(assess({ healthCondition: false }, { level: 'confirme' }).maxStrengthSessions).toBe(6);
  });

  it('prend le plancher de répétitions le plus haut', () => {
    expect(assess({}, { level: 'debutant' }).minReps).toBe(8);
    expect(assess({ age: 17 }, { level: 'debutant' }).minReps).toBe(10);
    expect(assess({}, { level: 'confirme' }).minReps).toBe(0);
  });

  it('demande une lecture explicite seulement quand un avis est invité', () => {
    expect(assess({}).requiresAcknowledgement).toBe(false);
    expect(assess({ age: 17 }).requiresAcknowledgement).toBe(false);
    expect(assess({}, { level: 'debutant' }).requiresAcknowledgement).toBe(false);
    expect(assess({ healthCondition: true }).requiresAcknowledgement).toBe(true);
    expect(assess({ pregnantOrBreastfeeding: true }).requiresAcknowledgement).toBe(true);
    expect(
      assess({ pregnantOrBreastfeeding: true }, { pregnancyStage: 'post-partum' })
        .requiresAcknowledgement,
    ).toBe(true);
  });

  it('ne pénalise pas ce qui est déjà exclu et pénalise charge axiale et instable pour un débutant', () => {
    const beginner = assess({}, { level: 'debutant' });
    expect(beginner.discouragedTags).toEqual(expect.arrayContaining(['charge-axiale', 'instable']));
    const pregnantBeginner = assess({ pregnantOrBreastfeeding: true }, { level: 'debutant' });
    expect(pregnantBeginner.discouragedTags).toEqual([]);
  });

  it('commence toujours par l’avertissement et reprend les textes validés', () => {
    const safety = assess({ age: 17, healthCondition: true }, { level: 'debutant' });
    expect(safety.messages[0]).toBe(TRAINING_SAFETY_MESSAGES.avertissement);
    expect(safety.messages.map((m) => m.code)).toEqual([
      'avertissement',
      'condition-sante',
      'mineur',
      'debutant',
    ]);
    expect(assess({}, { level: 'confirme' }).messages.map((m) => m.code)).toEqual([
      'avertissement',
    ]);
  });

  it('est déterministe', () => {
    const args = [{ age: 72, healthCondition: true }, { level: 'debutant' }] as const;
    expect(assess(...args)).toEqual(assess(...args));
  });
});

describe('excludedTagsOf', () => {
  it('liste les étiquettes d’un exercice que la sécurité exclut', () => {
    const safety = assess({ pregnantOrBreastfeeding: true });
    expect(excludedTagsOf(fixtureExercise('pont-fessier'), safety)).toEqual(['allonge-dos']);
    expect(excludedTagsOf(fixtureExercise('squat-poids-du-corps'), safety)).toEqual([]);
    expect(excludedTagsOf(fixtureExercise('crunch'), safety)).toEqual([
      'allonge-dos',
      'flexion-tronc',
    ]);
  });
});
