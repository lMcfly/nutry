import { describe, expect, it } from 'vitest';
import {
  EXERCISE_LICENSES,
  EXERCISE_LICENSE_URLS,
  VIDEO_LICENSES,
  VIDEO_LICENSE_URLS,
  exerciseCatalogFileSchema,
  exerciseEntrySchema,
} from './exerciseSchemas';

/** Exemple de référence du format cible (ADR 0015). */
const squat = {
  id: 'squat-poids-du-corps',
  name: 'Squat au poids du corps',
  kind: 'force',
  pattern: 'genou',
  movement: 'squat',
  primaryMuscles: ['quadriceps', 'fessiers'],
  secondaryMuscles: ['ischio-jambiers'],
  equipment: [],
  level: 'debutant',
  measure: 'repetitions',
  unilateral: false,
  tags: [],
  instructions: [
    'Pieds à largeur de hanches, pointes légèrement ouvertes.',
    'Descends en poussant les hanches en arrière, dos droit.',
    'Remonte en poussant dans les talons.',
  ],
  tips: ['Les genoux suivent la direction des pieds.'],
  harderId: 'squat-goblet',
  images: [
    {
      file: 'exercices/squat-poids-du-corps-1.webp',
      width: 480,
      height: 360,
      alt: 'Position de départ du squat, debout.',
      author: 'Nutry',
      license: 'MIT',
    },
  ],
  videos: [
    {
      file: 'exercices/videos/squat-poids-du-corps-1.mp4',
      poster: 'exercices/videos/squat-poids-du-corps-1.webp',
      durationSeconds: 12,
      sizeKb: 640,
      provider: 'wikimedia',
      author: 'Auteur Wikimedia',
      license: 'CC-BY-SA-4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Squat.webm',
    },
  ],
  youtubeSearchUrl: 'https://www.youtube.com/results?search_query=squat+poids+du+corps',
  credit: {
    provider: 'nutry',
    authors: ['Nutry'],
    license: 'MIT',
    modified: 'Rédigé pour Nutry.',
  },
};

const goblet = {
  ...Object.fromEntries(Object.entries(squat).filter(([key]) => key !== 'harderId')),
  id: 'squat-goblet',
  name: 'Squat goblet',
  equipment: ['halteres'],
  easierId: 'squat-poids-du-corps',
  images: [],
  videos: [],
};

const planche = {
  id: 'planche',
  name: 'Planche',
  kind: 'force',
  pattern: 'gainage',
  movement: 'planche',
  primaryMuscles: ['abdominaux'],
  secondaryMuscles: [],
  equipment: ['tapis'],
  level: 'debutant',
  measure: 'duree',
  unilateral: false,
  tags: ['au-sol', 'allonge-ventre'],
  instructions: ['En appui sur les avant-bras, corps aligné.'],
  tips: [],
  images: [],
  videos: [
    {
      file: 'exercices/videos/planche-1.mp4',
      durationSeconds: 8,
      sizeKb: 420,
      provider: 'mixkit',
      author: 'Auteur Mixkit',
      license: 'Mixkit',
      sourceUrl: 'https://mixkit.co/free-stock-video/plank/',
    },
  ],
  credit: {
    provider: 'nutry',
    authors: ['Nutry'],
    license: 'MIT',
    modified: 'Rédigé pour Nutry.',
  },
};

const file = (exercises: readonly unknown[]) => ({
  version: 1,
  source: { name: 'nutry', license: 'MIT' },
  exercises,
});

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe('catalogue d’exercices : format cible', () => {
  it('accepte l’exemple de référence', () => {
    const result = exerciseCatalogFileSchema.safeParse(file([squat, goblet, planche]));
    expect(messages(result)).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('donne une adresse à chaque licence', () => {
    for (const license of EXERCISE_LICENSES) {
      expect(EXERCISE_LICENSE_URLS[license]).toBe('LICENSE');
    }
    for (const license of VIDEO_LICENSES) {
      expect(VIDEO_LICENSE_URLS[license]).toMatch(/^(https:\/\/|LICENSE$)/);
    }
  });

  it.each([
    ['une nature incohérente', { ...squat, kind: 'cardio' }, /nature attendue/],
    ['un muscle hors du schéma', { ...squat, primaryMuscles: ['pectoraux'] }, /hors du schéma/],
    ['un exercice de force sans muscle', { ...squat, primaryMuscles: [] }, /au moins un muscle/],
    [
      'un muscle principal et secondaire',
      { ...squat, secondaryMuscles: ['quadriceps'] },
      /principal et secondaire/,
    ],
    ['une durée pour un squat', { ...squat, measure: 'duree' }, /pas de série en durée/],
    ['sa propre variante', { ...squat, harderId: squat.id }, /propre variante/],
    [
      'un lien YouTube qui n’est pas une recherche',
      { ...squat, youtubeSearchUrl: 'https://www.youtube.com/watch?v=abc' },
      /recherche YouTube attendue/,
    ],
    [
      'un lien vers un autre site',
      { ...squat, youtubeSearchUrl: 'https://example.com/results?search_query=squat' },
      /recherche YouTube attendue/,
    ],
    [
      'une vidéo hors du dossier',
      { ...squat, videos: [{ ...squat.videos[0], file: 'videos/squat.mp4' }] },
      /exercices\/videos/,
    ],
    ['une vidéo trop lourde', { ...squat, videos: [{ ...squat.videos[0], sizeKb: 5000 }] }, /./],
    [
      'une vidéo dont la page ne correspond pas à la source',
      { ...squat, videos: [{ ...squat.videos[0], provider: 'coverr', license: 'Coverr' }] },
      /coverr\.co attendue/,
    ],
    [
      'une licence Mixkit sur une vidéo Wikimedia',
      { ...squat, videos: [{ ...squat.videos[0], license: 'Mixkit' }] },
      /licence incohérente/,
    ],
    [
      'une vidéo Mixkit sous licence Creative Commons',
      { ...planche, videos: [{ ...planche.videos[0], license: 'CC0-1.0' }] },
      /licence incohérente/,
    ],
    [
      'une image hors du dossier',
      { ...squat, images: [{ ...squat.images[0], file: 'photos/x.webp' }] },
      /exercices\/<id>/,
    ],
    [
      'un contenu Nutry avec une source',
      { ...planche, credit: { ...planche.credit, sourceUrl: 'https://example.com/x' } },
      /sans source/,
    ],
    [
      'une licence Creative Commons sur un texte Nutry',
      { ...squat, credit: { ...squat.credit, license: 'CC0-1.0' } },
      /./,
    ],
    ['une fiche sans pose de mannequin', { ...squat, movement: undefined }, /./],
    ['une source wger', { ...squat, credit: { ...squat.credit, provider: 'wger' } }, /./],
    ['une clé inconnue', { ...squat, video: 'x' }, /./],
  ])('refuse %s', (_label, entry, expected) => {
    const result = exerciseEntrySchema.safeParse(JSON.parse(JSON.stringify(entry)));
    expect(result.success).toBe(false);
    expect(messages(result).join(' | ')).toMatch(expected);
  });

  it('contrôle les identifiants, les médias et les variantes sur tout le fichier', () => {
    const duplicate = exerciseCatalogFileSchema.safeParse(file([squat, squat]));
    expect(messages(duplicate).join(' | ')).toMatch(/identifiant en double/);
    expect(messages(duplicate).join(' | ')).toMatch(/fichier en double/);

    const orphan = exerciseCatalogFileSchema.safeParse(file([squat]));
    expect(messages(orphan).join(' | ')).toMatch(/variante inconnue/);

    const otherPattern = exerciseCatalogFileSchema.safeParse(
      file([{ ...squat, harderId: 'planche' }, planche]),
    );
    expect(messages(otherPattern).join(' | ')).toMatch(/autre schéma/);
  });
});
