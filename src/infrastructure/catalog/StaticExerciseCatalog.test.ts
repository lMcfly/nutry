import { describe, expect, it, vi } from 'vitest';
import { exerciseCatalogFileSchema, type ExerciseCatalogFile } from '../data/exerciseSchemas';
import {
  StaticExerciseCatalog,
  loadEmbeddedExercises,
  youtubeSearchFor,
} from './StaticExerciseCatalog';

const credit = {
  provider: 'nutry',
  authors: ['Nutry'],
  license: 'MIT',
  modified: 'Rédigé pour Nutry.',
} as const;

const base = {
  kind: 'force',
  pattern: 'genou',
  movement: 'squat',
  primaryMuscles: ['quadriceps'],
  secondaryMuscles: ['fessiers'],
  equipment: [],
  level: 'debutant',
  measure: 'repetitions',
  unilateral: false,
  tags: [],
  instructions: ['Descends, puis remonte.'],
  tips: [],
  images: [],
  videos: [],
  credit,
} as const;

const file = (): ExerciseCatalogFile =>
  exerciseCatalogFileSchema.parse({
    version: 1,
    source: { name: 'nutry', license: 'MIT' },
    exercises: [
      { ...base, id: 'squat-chaise', name: 'Squat sur chaise', harderId: 'squat' },
      {
        ...base,
        id: 'squat',
        name: 'Squat',
        easierId: 'squat-chaise',
        youtubeSearchUrl: 'https://www.youtube.com/results?search_query=squat+tuto',
        images: [
          {
            file: 'exercices/squat-1.webp',
            width: 480,
            height: 360,
            alt: 'Squat de profil',
            author: 'Nutry',
            license: 'MIT',
          },
        ],
        videos: [
          {
            file: 'exercices/videos/squat-1.mp4',
            poster: 'exercices/videos/squat-1.webp',
            durationSeconds: 20,
            sizeKb: 900,
            provider: 'mixkit',
            author: 'Mixkit',
            license: 'Mixkit',
            sourceUrl: 'https://mixkit.co/free-stock-video/squat/',
          },
        ],
      },
    ],
  });

describe('StaticExerciseCatalog', () => {
  it('rend les exercices du domain, sans média, crédit ni lien', async () => {
    const catalog = new StaticExerciseCatalog('/nutry/', () => Promise.resolve(file()));
    const exercises = await catalog.getExercises();
    expect(exercises.map((e) => e.id)).toEqual(['squat-chaise', 'squat']);
    for (const exercise of exercises) {
      expect(exercise).not.toHaveProperty('images');
      expect(exercise).not.toHaveProperty('videos');
      expect(exercise).not.toHaveProperty('credit');
      expect(exercise).not.toHaveProperty('youtubeSearchUrl');
    }
    expect(exercises[0]).toMatchObject({ harderId: 'squat', movement: 'squat' });
    expect(exercises[0]).not.toHaveProperty('easierId');
  });

  it('rend images, vidéos, recherche YouTube et crédit MIT d’un exercice', async () => {
    const catalog = new StaticExerciseCatalog('/nutry', () => Promise.resolve(file()));
    const media = await catalog.getMedia('squat');
    expect(media).toEqual({
      exerciseId: 'squat',
      images: [
        {
          src: '/nutry/exercices/squat-1.webp',
          width: 480,
          height: 360,
          alt: 'Squat de profil',
          author: 'Nutry',
          license: 'MIT',
        },
      ],
      videos: [
        {
          src: '/nutry/exercices/videos/squat-1.mp4',
          poster: '/nutry/exercices/videos/squat-1.webp',
          durationSeconds: 20,
          provider: 'mixkit',
          author: 'Mixkit',
          license: 'Mixkit',
          licenseUrl: 'https://mixkit.co/license/',
          sourceUrl: 'https://mixkit.co/free-stock-video/squat/',
        },
      ],
      links: [{ kind: 'youtube', url: 'https://www.youtube.com/results?search_query=squat+tuto' }],
      credit: {
        provider: 'nutry',
        authors: ['Nutry'],
        license: 'MIT',
        licenseUrl: 'https://opensource.org/licenses/MIT',
        modified: 'Rédigé pour Nutry.',
      },
    });
  });

  it('construit la recherche YouTube depuis le nom quand le fichier n’en donne pas', async () => {
    const catalog = new StaticExerciseCatalog('/', () => Promise.resolve(file()));
    const media = await catalog.getMedia('squat-chaise');
    expect(media?.links).toEqual([{ kind: 'youtube', url: youtubeSearchFor('Squat sur chaise') }]);
    expect(youtubeSearchFor('Pompes & dips')).toBe(
      'https://www.youtube.com/results?search_query=Pompes+%26+dips+tuto',
    );
    expect(media?.images).toEqual([]);
    expect(media?.videos).toEqual([]);
  });

  it('ne dit rien d’un exercice inconnu', async () => {
    const catalog = new StaticExerciseCatalog('/', () => Promise.resolve(file()));
    await expect(catalog.getMedia('inconnu')).resolves.toBeUndefined();
  });

  it('charge une seule fois', async () => {
    const load = vi.fn(() => Promise.resolve(file()));
    const catalog = new StaticExerciseCatalog('/', load);
    await catalog.getExercises();
    await catalog.getMedia('squat');
    await catalog.getExercises();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('remonte l’erreur et permet un nouvel essai', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('Catalogue d’exercices invalide'))
      .mockResolvedValue(file());
    const catalog = new StaticExerciseCatalog('/', load);
    await expect(catalog.getExercises()).rejects.toThrow(/invalide/);
    await expect(catalog.getExercises()).resolves.toHaveLength(2);
  });
});

describe('catalogue embarqué réel', () => {
  it('se charge, se valide et se sépare (domain / médias)', async () => {
    const catalog = new StaticExerciseCatalog('/nutry/');
    const exercises = await catalog.getExercises();
    expect(exercises.length).toBeGreaterThanOrEqual(150);
    const media = await catalog.getMedia(exercises[0]?.id ?? '');
    expect(media?.credit.licenseUrl).toBe('https://opensource.org/licenses/MIT');
    expect(media?.links[0]?.url).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/);
  });

  it('loadEmbeddedExercises rend le fichier validé', async () => {
    const loaded = await loadEmbeddedExercises();
    expect(loaded.source).toEqual({ name: 'nutry', license: 'MIT' });
  });
});
