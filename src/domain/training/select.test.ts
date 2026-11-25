import { describe, expect, it } from 'vitest';
import { EXERCISE_FIXTURES, fixtureExercise } from '../testing/exercises.fixtures';
import { makeProfile } from '../testing/fixtures';
import { makeTraining } from '../testing/training.fixtures';
import {
  ALWAYS_AVAILABLE_EQUIPMENT,
  EQUIPMENT_BY_SETTING,
  PREFERRED_EQUIPMENT,
  assessTrainingSafety,
  findAlternatives,
  isExerciseEligible,
  isLoadedExercise,
  loadEquipmentOf,
  pickExercise,
  rankExercises,
  type CycleInfo,
  type EligibilityContext,
  type EquipmentSetting,
  type MovementPattern,
  type SlotRole,
  type TrainingLevel,
} from '.';
import type { Profile } from '../profile';
import type { TrainingProfile } from './training.types';

function context(
  pattern: MovementPattern,
  options: {
    role?: SlotRole;
    level?: TrainingLevel;
    setting?: EquipmentSetting;
    profile?: Partial<Profile>;
    training?: Partial<TrainingProfile>;
    avoided?: string[];
  } = {},
): EligibilityContext {
  const level = options.level ?? 'intermediaire';
  const setting = options.setting ?? 'salle';
  return {
    pattern,
    role: options.role ?? 'principal',
    level,
    equipment: EQUIPMENT_BY_SETTING[setting],
    safety: assessTrainingSafety(
      makeProfile(options.profile),
      makeTraining({ level, setting, ...options.training }),
    ),
    avoidedExerciseIds: options.avoided ?? [],
  };
}

const eligible = (c: EligibilityContext) =>
  EXERCISE_FIXTURES.filter((e) => isExerciseEligible(e, c)).map((e) => e.id);
const ids = (list: readonly { id: string }[]) => list.map((e) => e.id);

describe('isExerciseEligible : filtre dur', () => {
  it('exige le même schéma', () => {
    for (const id of eligible(context('genou'))) expect(fixtureExercise(id).pattern).toBe('genou');
    expect(isExerciseEligible(fixtureExercise('pompes'), context('genou'))).toBe(false);
  });

  it('exige tout le matériel de l’exercice (le tapis est toujours disponible)', () => {
    const home = context('poussee-horizontale', { setting: 'maison' });
    expect(isExerciseEligible(fixtureExercise('developpe-couche-halteres'), home)).toBe(false);
    expect(isExerciseEligible(fixtureExercise('pompes-murales'), home)).toBe(true);
    const bench = { ...context('poussee-horizontale'), equipment: ['halteres'] as const };
    expect(isExerciseEligible(fixtureExercise('developpe-couche-halteres'), bench)).toBe(false);
    const noMat = { ...context('gainage'), equipment: [] };
    expect(ALWAYS_AVAILABLE_EQUIPMENT).toContain('tapis');
    expect(isExerciseEligible({ ...fixtureExercise('planche'), equipment: ['tapis'] }, noMat)).toBe(
      true,
    );
  });

  it('refuse un exercice d’un niveau supérieur', () => {
    const beginner = context('poussee-horizontale', { level: 'debutant' });
    expect(isExerciseEligible(fixtureExercise('pompes'), beginner)).toBe(false);
    expect(
      isExerciseEligible(fixtureExercise('pompes-pliometriques'), context('poussee-horizontale')),
    ).toBe(false);
    expect(
      isExerciseEligible(
        fixtureExercise('pompes-pliometriques'),
        context('poussee-horizontale', { level: 'confirme' }),
      ),
    ).toBe(true);
  });

  it('refuse toute étiquette exclue par la sécurité', () => {
    const pregnant = context('hanche', { profile: { pregnantOrBreastfeeding: true } });
    expect(isExerciseEligible(fixtureExercise('pont-fessier'), pregnant)).toBe(false);
    expect(isExerciseEligible(fixtureExercise('bonjour-poids-du-corps'), pregnant)).toBe(true);
    const t1 = context('hanche', {
      profile: { pregnantOrBreastfeeding: true },
      training: { pregnancyStage: 'premier-trimestre' },
    });
    expect(isExerciseEligible(fixtureExercise('pont-fessier'), t1)).toBe(true);
    expect(
      isExerciseEligible(
        fixtureExercise('kettlebell-swing'),
        context('hanche', { profile: { healthCondition: true } }),
      ),
    ).toBe(false);
  });

  it('refuse un exercice écarté pour douleur', () => {
    const c = context('genou', { avoided: ['squat-barre'] });
    expect(isExerciseEligible(fixtureExercise('squat-barre'), c)).toBe(false);
    expect(isExerciseEligible(fixtureExercise('presse-a-cuisses'), c)).toBe(true);
  });

  it('refuse un exercice dont un muscle principal sort du schéma ou dont la nature ne correspond pas', () => {
    const wrongMuscle = {
      ...fixtureExercise('squat-chaise'),
      primaryMuscles: ['pectoraux' as const],
    };
    expect(isExerciseEligible(wrongMuscle, context('genou'))).toBe(false);
    const wrongKind = { ...fixtureExercise('squat-chaise'), kind: 'cardio' as const };
    expect(isExerciseEligible(wrongKind, context('genou'))).toBe(false);
  });
});

describe('machines de salle', () => {
  it('ne sont proposées que si la machine est dans le matériel (salle uniquement par défaut)', () => {
    for (const setting of ['maison', 'maison-equipee'] as const) {
      for (const exercise of EXERCISE_FIXTURES.filter((e) => e.equipment.includes('machine'))) {
        expect(
          isExerciseEligible(exercise, context(exercise.pattern, { setting })),
          exercise.id,
        ).toBe(false);
      }
    }
    expect(eligible(context('genou'))).toEqual(
      expect.arrayContaining(['presse-a-cuisses', 'leg-extension-machine']),
    );
    expect(eligible(context('hanche'))).toEqual(
      expect.arrayContaining([
        'leg-curl-machine',
        'hip-thrust-machine',
        'abducteurs-machine',
        'adducteurs-machine',
        'banc-a-lombaires',
      ]),
    );
    expect(eligible(context('poussee-horizontale'))).toEqual(
      expect.arrayContaining(['developpe-machine-assis', 'pec-deck-machine']),
    );
    expect(eligible(context('poussee-verticale'))).toContain('developpe-epaules-machine');
    expect(eligible(context('tirage-vertical'))).toEqual(
      expect.arrayContaining(['tirage-vertical-machine', 'tractions-assistees']),
    );
    expect(eligible(context('tirage-horizontal'))).toContain('rowing-assis-machine');
    expect(eligible(context('mollets'))).toContain('releve-mollets-machine');
    expect(eligible(context('gainage'))).toContain('crunch-machine');
    expect(eligible(context('extension-coude'))).toContain('dips-assistes-machine');
  });

  it('classe une machine guidée devant les charges libres pour un débutant en salle', () => {
    for (const role of ['principal', 'secondaire'] as const) {
      const c = context('genou', { level: 'debutant', role });
      const ranked = rankExercises(
        EXERCISE_FIXTURES.filter((e) => isExerciseEligible(e, c)),
        {
          ...c,
          preferredEquipment: PREFERRED_EQUIPMENT.salle,
          usedThisWeek: [],
        },
      );
      expect(fixtureExercise(ranked[0]?.id ?? '').equipment, role).toContain('machine');
    }
  });

  it('ne favorise pas la machine pour un accessoire, ni pour un niveau plus avancé', () => {
    const prefer = (level: TrainingLevel, role: SlotRole) => {
      const c = context('tirage-vertical', { level, role });
      return ids(
        rankExercises(
          EXERCISE_FIXTURES.filter((e) => isExerciseEligible(e, c)),
          { ...c, preferredEquipment: [], usedThisWeek: [] },
        ),
      );
    };
    expect(prefer('debutant', 'accessoire')[0]).not.toMatch(/machine|assistees/);
    expect(prefer('confirme', 'principal')[0]).not.toMatch(/machine|assistees/);
  });
});

describe('rankExercises', () => {
  const rank = (
    c: EligibilityContext,
    extra: { preferred?: readonly string[]; used?: string[] } = {},
  ) =>
    ids(
      rankExercises(
        EXERCISE_FIXTURES.filter((e) => isExerciseEligible(e, c)),
        {
          ...c,
          preferredEquipment: (extra.preferred ?? []) as never,
          usedThisWeek: extra.used ?? [],
        },
      ),
    );

  it('trie par identifiant à score égal (déterministe, indépendant de l’ordre d’entrée)', () => {
    const curls = EXERCISE_FIXTURES.filter((e) => e.pattern === 'flexion-coude');
    const c = {
      ...context('flexion-coude', { level: 'confirme' }),
      preferredEquipment: [],
      usedThisWeek: [],
    };
    const forward = ids(rankExercises(curls, c));
    expect(ids(rankExercises([...curls].reverse(), c))).toEqual(forward);
    const tied = forward.filter((id) => fixtureExercise(id).level !== 'confirme');
    expect(tied).toEqual([...tied].sort());
  });

  it('donne +3 au matériel préféré d’un créneau principal, pas d’un accessoire', () => {
    const main = rank(context('poussee-horizontale', { level: 'confirme' }), {
      preferred: ['barre'],
    });
    expect(main[0]).toBe('developpe-couche-barre');
    const accessory = rank(
      context('poussee-horizontale', { level: 'confirme', role: 'accessoire' }),
      { preferred: ['barre'] },
    );
    expect(accessory[0]).toBe('pompes-pliometriques');
  });

  it('donne +1 au niveau égal à celui de la personne', () => {
    const list = rank(
      context('poussee-horizontale', { level: 'intermediaire', role: 'accessoire' }),
    );
    expect(list.indexOf('pompes')).toBeLessThan(list.indexOf('developpe-incline-halteres'));
  });

  it('retire 2 points par étiquette déconseillée (charge axiale et instable pour un débutant)', () => {
    const list = rank(context('genou', { level: 'debutant', role: 'accessoire' }));
    const bulgare = { ...fixtureExercise('squat-bulgare') };
    expect(list).not.toContain(bulgare.id);
    const c = context('genou', {
      level: 'intermediaire',
      role: 'accessoire',
      profile: { age: 69 },
    });
    const withTags = {
      ...c,
      safety: { ...c.safety, discouragedTags: ['instable', 'charge-axiale'] as const },
    };
    const ranked = ids(
      rankExercises(
        [
          fixtureExercise('squat-bulgare'),
          fixtureExercise('squat-barre'),
          fixtureExercise('fentes-arriere'),
        ],
        {
          ...withTags,
          preferredEquipment: [],
          usedThisWeek: [],
        },
      ),
    );
    expect(ranked[0]).toBe('fentes-arriere');
  });

  it('retire 5 points à un exercice déjà utilisé dans la semaine', () => {
    const c = context('genou', { level: 'intermediaire', role: 'accessoire', setting: 'maison' });
    const first = rank(c)[0] as string;
    const afterUse = rank(c, { used: [first] });
    expect(afterUse[0]).not.toBe(first);
    expect(afterUse).toContain(first);
  });
});

describe('pickExercise : rotation', () => {
  const ranked = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ ...fixtureExercise('pompes'), id }));
  const cycle = (blockIndex: number, activeWeeks: number): CycleInfo => ({
    activeWeeks,
    blockIndex,
    weekInBlock: 1,
    blockLength: 5,
    deload: false,
  });
  const pick = (role: SlotRole, c: CycleInfo, list = ranked) => pickExercise(list, role, c)?.id;

  it('garde principal et secondaire pendant tout un bloc, puis change au bloc suivant', () => {
    for (const role of ['principal', 'secondaire'] as const) {
      for (let week = 0; week < 5; week += 1) expect(pick(role, cycle(0, week))).toBe('a');
      expect(pick(role, cycle(1, 5))).toBe('b');
      expect(pick(role, cycle(2, 10))).toBe('c');
      expect(pick(role, cycle(3, 15))).toBe('a');
    }
  });

  it('fait tourner l’accessoire chaque semaine active, dans les 3 premiers', () => {
    expect([0, 1, 2, 3, 4, 5].map((week) => pick('accessoire', cycle(0, week)))).toEqual([
      'a',
      'b',
      'c',
      'a',
      'b',
      'c',
    ]);
  });

  it('se limite au nombre de candidats et rend undefined sans candidat', () => {
    expect(pick('principal', cycle(1, 5), ranked.slice(0, 1))).toBe('a');
    expect(pick('accessoire', cycle(0, 1), ranked.slice(0, 2))).toBe('b');
    expect(pick('principal', cycle(0, 0), [])).toBeUndefined();
  });
});

describe('findAlternatives', () => {
  it('propose jusqu’à 3 remplaçants du même schéma, éligibles, sans l’exercice d’origine', () => {
    const original = fixtureExercise('squat-barre');
    const result = findAlternatives({
      exercise: original,
      reason: 'choix',
      catalog: EXERCISE_FIXTURES,
      context: context('genou'),
    });
    expect(result).toHaveLength(3);
    for (const alt of result) {
      expect(alt.pattern).toBe('genou');
      expect(alt.id).not.toBe(original.id);
      expect(isExerciseEligible(alt, context('genou'))).toBe(true);
    }
  });

  it('prend le schéma de l’exercice même si le contexte en annonce un autre', () => {
    const result = findAlternatives({
      exercise: fixtureExercise('pompes'),
      reason: 'choix',
      catalog: EXERCISE_FIXTURES,
      context: context('genou'),
    });
    expect(result.every((e) => e.pattern === 'poussee-horizontale')).toBe(true);
  });

  it('après une douleur : la variante plus facile d’abord, puis les exercices sans charge', () => {
    const c = context('poussee-horizontale', { level: 'confirme' });
    const result = findAlternatives({
      exercise: fixtureExercise('pompes'),
      reason: 'douleur',
      catalog: EXERCISE_FIXTURES,
      context: c,
    });
    expect(result[0]?.id).toBe('pompes-genoux');
    expect(result[1]?.id).toBe('pompes-murales');
    expect(result.slice(1).every((e) => !e.tags.includes('au-sol'))).toBe(true);
  });

  it('classe la variante easierId en premier quand elle est éligible', () => {
    const c = context('tirage-vertical', { level: 'confirme' });
    const result = findAlternatives({
      exercise: fixtureExercise('tractions'),
      reason: 'douleur',
      catalog: EXERCISE_FIXTURES,
      context: c,
    });
    expect(result[0]?.id).toBe('tractions-assistees');
  });

  it('écarte les étiquettes de l’exercice douloureux et reste dans les exclusions de sécurité', () => {
    const painful = fixtureExercise('pompes-genoux'); // au-sol
    const c = context('poussee-horizontale', { level: 'confirme' });
    const result = findAlternatives({
      exercise: painful,
      reason: 'douleur',
      catalog: EXERCISE_FIXTURES,
      context: c,
    });
    expect(result.length).toBeGreaterThan(0);
    for (const alt of result) expect(alt.tags).not.toContain('au-sol');
    const pregnant = context('hanche', {
      level: 'confirme',
      profile: { pregnantOrBreastfeeding: true },
    });
    const hips = findAlternatives({
      exercise: fixtureExercise('bonjour-poids-du-corps'),
      reason: 'douleur',
      catalog: EXERCISE_FIXTURES,
      context: pregnant,
    });
    for (const alt of hips) expect(alt.tags).not.toContain('allonge-dos');
  });

  it('place les exercices sans charge avant ceux avec charge, puis le niveau plus bas', () => {
    const c = context('genou', { level: 'confirme', setting: 'maison-equipee' });
    const result = findAlternatives({
      exercise: fixtureExercise('squat-barre'),
      reason: 'douleur',
      catalog: EXERCISE_FIXTURES,
      context: { ...c, avoidedExerciseIds: ['squat-barre'] },
    });
    expect(result).toHaveLength(3);
    expect(isLoadedExercise(result[0] as never)).toBe(false);
    const unloaded = result.filter((e) => !isLoadedExercise(e));
    expect(result.slice(0, unloaded.length)).toEqual(unloaded);
    const lowerLevel = findAlternatives({
      exercise: fixtureExercise('developpe-couche-barre'),
      reason: 'douleur',
      catalog: [
        fixtureExercise('developpe-incline-halteres'),
        {
          ...fixtureExercise('pompes-elastique'),
          equipment: ['barre', 'banc'],
          level: 'intermediaire',
          tags: [],
        },
      ],
      context: context('poussee-horizontale', { level: 'confirme' }),
    });
    expect(lowerLevel[0]?.id).toBe('developpe-incline-halteres');
  });

  it('rend une liste vide quand rien ne convient', () => {
    expect(
      findAlternatives({
        exercise: fixtureExercise('pompes'),
        reason: 'choix',
        catalog: [fixtureExercise('pompes')],
        context: context('poussee-horizontale'),
      }),
    ).toEqual([]);
  });
});

describe('matériel chargé', () => {
  it('reconnaît le matériel qui porte une charge réglable', () => {
    expect(loadEquipmentOf(fixtureExercise('developpe-couche-halteres'))).toBe('halteres');
    expect(loadEquipmentOf(fixtureExercise('presse-a-cuisses'))).toBe('machine');
    expect(loadEquipmentOf(fixtureExercise('pompes-elastique'))).toBeUndefined();
    expect(isLoadedExercise(fixtureExercise('pompes'))).toBe(false);
  });
});
