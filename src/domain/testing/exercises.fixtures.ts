/**
 * Petit catalogue d'exercices pour les tests du module Sport (ADR 0015). Il couvre chaque
 * schéma de mouvement, chaque cadre (maison, maison équipée, salle) et, pour chaque schéma,
 * au moins un exercice au poids du corps sans aucune étiquette de sécurité : tout profil
 * protégé trouve donc un candidat à chaque créneau. Jamais importé par le code de prod ; le vrai
 * catalogue est celui de l'infrastructure (`exercises.json`).
 */
import {
  PATTERN_KIND,
  type Equipment,
  type ExerciseTag,
  type MovementPattern,
  type MuscleGroup,
  type TrainingLevel,
} from '../training/training.constants';
import type { Exercise } from '../training/training.types';

interface Options {
  readonly unilateral?: boolean;
  readonly easierId?: string;
  readonly harderId?: string;
  readonly movement?: string;
}

const TIMED: readonly MovementPattern[] = ['gainage', 'cardio', 'mobilite', 'equilibre'];

function make(
  id: string,
  pattern: MovementPattern,
  primaryMuscles: readonly MuscleGroup[],
  secondaryMuscles: readonly MuscleGroup[],
  equipment: readonly Equipment[],
  level: TrainingLevel,
  tags: readonly ExerciseTag[] = [],
  options: Options = {},
): Exercise {
  return {
    id,
    name: id.replace(/-/g, ' '),
    kind: PATTERN_KIND[pattern],
    pattern,
    movement: options.movement ?? id,
    primaryMuscles,
    secondaryMuscles,
    equipment,
    level,
    measure: TIMED.includes(pattern) ? 'duree' : 'repetitions',
    unilateral: options.unilateral ?? false,
    tags,
    instructions: ['Installe-toi calmement.', 'Fais le mouvement lentement.'],
    tips: ['Respire sans bloquer.'],
    ...(options.easierId ? { easierId: options.easierId } : {}),
    ...(options.harderId ? { harderId: options.harderId } : {}),
  };
}

const D = 'debutant';
const I = 'intermediaire';
const C = 'confirme';

export const EXERCISE_FIXTURES: readonly Exercise[] = [
  // Poussée horizontale
  make('pompes-murales', 'poussee-horizontale', ['pectoraux'], ['triceps', 'epaules'], [], D, [], {
    harderId: 'pompes-genoux',
  }),
  make(
    'pompes-genoux',
    'poussee-horizontale',
    ['pectoraux'],
    ['triceps', 'epaules'],
    [],
    D,
    ['au-sol'],
    { easierId: 'pompes-murales', harderId: 'pompes' },
  ),
  make('pompes', 'poussee-horizontale', ['pectoraux'], ['triceps', 'epaules'], [], I, ['au-sol'], {
    easierId: 'pompes-genoux',
  }),
  make(
    'developpe-couche-halteres',
    'poussee-horizontale',
    ['pectoraux'],
    ['triceps', 'epaules'],
    ['halteres', 'banc'],
    D,
    ['allonge-dos'],
  ),
  make(
    'developpe-incline-halteres',
    'poussee-horizontale',
    ['pectoraux'],
    ['triceps', 'epaules'],
    ['halteres', 'banc-incline'],
    D,
  ),
  make(
    'developpe-couche-barre',
    'poussee-horizontale',
    ['pectoraux'],
    ['triceps', 'epaules'],
    ['barre', 'banc'],
    I,
    ['allonge-dos'],
  ),
  make('pompes-elastique', 'poussee-horizontale', ['pectoraux'], ['triceps'], ['elastique'], I, [
    'au-sol',
  ]),
  make('pompes-pliometriques', 'poussee-horizontale', ['pectoraux'], ['triceps'], [], C, [
    'impact',
    'haute-intensite',
    'au-sol',
  ]),
  make(
    'developpe-machine-assis',
    'poussee-horizontale',
    ['pectoraux'],
    ['triceps', 'epaules'],
    ['machine'],
    D,
  ),
  make('pec-deck-machine', 'poussee-horizontale', ['pectoraux'], ['epaules'], ['machine'], D),
  make('pompes-swiss-ball', 'poussee-horizontale', ['pectoraux'], ['triceps'], ['swiss-ball'], I, [
    'instable',
    'au-sol',
  ]),
  // Poussée verticale
  make('pompes-pike-genoux', 'poussee-verticale', ['epaules'], ['triceps'], [], D),
  make(
    'developpe-epaules-halteres',
    'poussee-verticale',
    ['epaules'],
    ['triceps'],
    ['halteres'],
    D,
  ),
  make(
    'developpe-epaules-elastique',
    'poussee-verticale',
    ['epaules'],
    ['triceps'],
    ['elastique'],
    D,
  ),
  make('pompes-pike', 'poussee-verticale', ['epaules'], ['triceps'], [], I, ['au-sol']),
  make('developpe-militaire-barre', 'poussee-verticale', ['epaules'], ['triceps'], ['barre'], I, [
    'charge-axiale',
  ]),
  make('developpe-epaules-machine', 'poussee-verticale', ['epaules'], ['triceps'], ['machine'], D),
  // Tirage horizontal
  make('rowing-serviette-porte', 'tirage-horizontal', ['dos'], ['biceps'], [], D),
  make('rowing-elastique', 'tirage-horizontal', ['dos'], ['biceps'], ['elastique'], D),
  make(
    'rowing-un-bras-halteres',
    'tirage-horizontal',
    ['dos'],
    ['biceps'],
    ['halteres', 'banc'],
    D,
    [],
    { unilateral: true },
  ),
  make('rowing-barre', 'tirage-horizontal', ['dos'], ['biceps'], ['barre'], I),
  make('tirage-poulie-basse', 'tirage-horizontal', ['dos'], ['biceps'], ['poulie'], D),
  make('rowing-assis-machine', 'tirage-horizontal', ['dos'], ['biceps'], ['machine'], D),
  make('rowing-inverse-table', 'tirage-horizontal', ['dos'], ['biceps'], [], I, ['au-sol']),
  // Tirage vertical
  make('tirage-vertical-serviette', 'tirage-vertical', ['dos'], ['biceps'], [], D),
  make('tirage-vertical-elastique', 'tirage-vertical', ['dos'], ['biceps'], ['elastique'], D),
  make('tractions', 'tirage-vertical', ['dos', 'biceps'], [], ['barre-traction'], I, [], {
    easierId: 'tractions-assistees',
  }),
  make('tractions-assistees', 'tirage-vertical', ['dos'], ['biceps'], ['machine'], D, [], {
    harderId: 'tractions',
  }),
  make('tirage-poitrine-poulie', 'tirage-vertical', ['dos'], ['biceps'], ['poulie'], D),
  make('tirage-vertical-machine', 'tirage-vertical', ['dos'], ['biceps'], ['machine'], D),
  make('pullover-halteres', 'tirage-vertical', ['dos'], ['pectoraux'], ['halteres', 'banc'], I, [
    'allonge-dos',
  ]),
  // Genou
  make('squat-chaise', 'genou', ['quadriceps'], ['fessiers'], [], D, [], {
    harderId: 'squat-poids-du-corps',
  }),
  make(
    'squat-poids-du-corps',
    'genou',
    ['quadriceps'],
    ['fessiers', 'ischio-jambiers'],
    [],
    D,
    [],
    { easierId: 'squat-chaise' },
  ),
  make(
    'squat-gobelet-halteres',
    'genou',
    ['quadriceps'],
    ['fessiers', 'ischio-jambiers'],
    ['halteres'],
    D,
  ),
  make('fentes-arriere', 'genou', ['quadriceps', 'fessiers'], ['ischio-jambiers'], [], D, [], {
    unilateral: true,
  }),
  make('squat-barre', 'genou', ['quadriceps'], ['fessiers', 'lombaires'], ['barre'], I, [
    'charge-axiale',
  ]),
  make('squat-saute', 'genou', ['quadriceps'], ['fessiers', 'mollets'], [], I, [
    'impact',
    'haute-intensite',
  ]),
  make('squat-bulgare', 'genou', ['quadriceps', 'fessiers'], [], ['banc'], I, ['instable'], {
    unilateral: true,
  }),
  make('presse-a-cuisses', 'genou', ['quadriceps'], ['fessiers'], ['machine'], D),
  make('leg-extension-machine', 'genou', ['quadriceps'], [], ['machine'], D),
  // Hanche
  make('pont-fessier', 'hanche', ['fessiers'], ['ischio-jambiers'], [], D, [
    'allonge-dos',
    'au-sol',
  ]),
  make('bonjour-poids-du-corps', 'hanche', ['fessiers', 'ischio-jambiers'], ['lombaires'], [], D),
  make(
    'souleve-de-terre-roumain-halteres',
    'hanche',
    ['ischio-jambiers', 'fessiers'],
    ['lombaires'],
    ['halteres'],
    D,
  ),
  make(
    'souleve-de-terre-barre',
    'hanche',
    ['ischio-jambiers', 'fessiers'],
    ['lombaires'],
    ['barre'],
    I,
    ['charge-axiale'],
  ),
  make(
    'kettlebell-swing',
    'hanche',
    ['fessiers', 'ischio-jambiers'],
    ['lombaires'],
    ['kettlebell'],
    I,
    ['haute-intensite'],
  ),
  make('hip-thrust-machine', 'hanche', ['fessiers'], ['ischio-jambiers'], ['machine'], D),
  make('leg-curl-machine', 'hanche', ['ischio-jambiers'], [], ['machine'], D),
  make('abducteurs-machine', 'hanche', ['fessiers'], [], ['machine'], D),
  make('adducteurs-machine', 'hanche', ['ischio-jambiers'], ['fessiers'], ['machine'], D),
  make(
    'banc-a-lombaires',
    'hanche',
    ['lombaires', 'fessiers'],
    ['ischio-jambiers'],
    ['machine'],
    D,
    ['allonge-ventre'],
  ),
  make(
    'quadrupedie-extension-hanche',
    'hanche',
    ['fessiers'],
    ['ischio-jambiers'],
    [],
    D,
    ['au-sol'],
    { unilateral: true },
  ),
  // Gainage
  make('gainage-mur', 'gainage', ['abdominaux'], ['epaules'], [], D),
  make('planche-genoux', 'gainage', ['abdominaux'], ['epaules'], [], D, ['au-sol'], {
    harderId: 'planche',
  }),
  make('planche', 'gainage', ['abdominaux'], ['epaules', 'lombaires'], [], I, ['au-sol'], {
    easierId: 'planche-genoux',
  }),
  make('oiseau-chien', 'gainage', ['lombaires', 'abdominaux'], ['fessiers'], [], D, ['au-sol'], {
    unilateral: true,
  }),
  make('gainage-lateral', 'gainage', ['abdominaux'], ['epaules'], [], D, ['au-sol'], {
    unilateral: true,
  }),
  make('dead-bug', 'gainage', ['abdominaux'], [], [], D, ['allonge-dos', 'au-sol']),
  make('crunch', 'gainage', ['abdominaux'], [], [], D, ['allonge-dos', 'flexion-tronc', 'au-sol']),
  make('crunch-machine', 'gainage', ['abdominaux'], [], ['machine'], D, ['flexion-tronc']),
  make('gainage-swiss-ball', 'gainage', ['abdominaux'], ['epaules'], ['swiss-ball'], I, [
    'instable',
    'au-sol',
  ]),
  // Flexion du coude
  make('curl-isometrique-serviette', 'flexion-coude', ['biceps'], [], [], D),
  make('curl-halteres', 'flexion-coude', ['biceps'], [], ['halteres'], D),
  make('curl-elastique', 'flexion-coude', ['biceps'], [], ['elastique'], D),
  make('curl-barre-ez', 'flexion-coude', ['biceps'], [], ['barre-ez'], I),
  make('curl-poulie', 'flexion-coude', ['biceps'], [], ['poulie'], D),
  // Extension du coude
  make('dips-chaise', 'extension-coude', ['triceps'], ['epaules'], [], D),
  make('extension-triceps-halteres', 'extension-coude', ['triceps'], [], ['halteres'], D),
  make('extension-triceps-elastique', 'extension-coude', ['triceps'], [], ['elastique'], D),
  make('dips-assistes-machine', 'extension-coude', ['triceps'], ['pectoraux'], ['machine'], D),
  make('pompes-diamant', 'extension-coude', ['triceps'], ['pectoraux'], [], I, ['au-sol']),
  // Mollets
  make('releve-mollets-debout', 'mollets', ['mollets'], [], [], D),
  make('releve-mollets-halteres', 'mollets', ['mollets'], [], ['halteres'], D),
  make('releve-mollets-machine', 'mollets', ['mollets'], [], ['machine'], D),
  make('releve-mollets-unipodal', 'mollets', ['mollets'], [], [], I, ['instable'], {
    unilateral: true,
  }),
  // Cardio
  make('marche-rapide', 'cardio', [], [], [], D),
  make('step-lateral', 'cardio', [], [], [], D),
  make('jumping-jacks', 'cardio', [], [], [], D, ['impact']),
  make('corde-a-sauter', 'cardio', [], [], [], I, ['impact', 'haute-intensite']),
  // Mobilité
  make('cercles-epaules', 'mobilite', [], ['epaules', 'dos'], [], D),
  make('rotation-thoracique', 'mobilite', [], ['dos', 'lombaires'], [], D),
  make('chat-vache', 'mobilite', [], ['dos', 'lombaires'], [], D, ['au-sol']),
  make('etirement-hanches-fente', 'mobilite', [], ['fessiers', 'quadriceps'], [], D),
  make('etirement-ischios-debout', 'mobilite', [], ['ischio-jambiers', 'lombaires'], [], D),
  make('etirement-pectoraux-mur', 'mobilite', [], ['pectoraux', 'epaules', 'biceps'], [], D),
  make('etirement-triceps', 'mobilite', [], ['triceps'], [], D),
  make('etirement-mollets-mur', 'mobilite', [], ['mollets'], [], D),
  make('respiration-diaphragmatique', 'mobilite', [], ['abdominaux'], [], D),
  // Équilibre
  make('equilibre-unipodal-appui', 'equilibre', [], [], [], D, [], { unilateral: true }),
  make('marche-talon-pointe', 'equilibre', [], [], [], D),
  make('equilibre-unipodal-libre', 'equilibre', [], [], [], I, ['instable'], { unilateral: true }),
];

/** Exercice du catalogue de test par identifiant (lève si absent : une faute de frappe se voit). */
export function fixtureExercise(id: string): Exercise {
  const found = EXERCISE_FIXTURES.find((exercise) => exercise.id === id);
  if (!found) throw new Error(`Exercice de test inconnu : ${id}`);
  return found;
}
