import { z } from './zod';
import type {
  CreativeCommonsLicense,
  ExerciseLicense,
  ExerciseProvider,
  VideoLicense,
  VideoProvider,
} from '@application/ports';
import {
  EQUIPMENT,
  EXERCISE_KINDS,
  EXERCISE_MEASURES,
  EXERCISE_TAGS,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  PATTERN_KIND,
  PATTERN_PRIMARY_GROUPS,
  TRAINING_LEVELS,
  type Exercise,
  type MovementPattern,
} from '@domain/training';

/**
 * Format cible du catalogue d'exercices embarqué (`exercises.json`, ADR 0015). Contenu
 * propre à Nutry (textes, poses de mannequin), sous la licence du dépôt (MIT) ; validé par
 * `npm run validate-data`.
 * Une entrée = l'exercice du domain + ses images, ses vidéos et son crédit, que
 * l'adaptateur `StaticExerciseCatalog` sépare (le domain ne voit ni chemin ni licence).
 */

export { EXERCISE_LICENSE_URLS, VIDEO_LICENSE_URLS } from './exerciseLicenses';

export const EXERCISE_LICENSES = ['MIT'] as const satisfies readonly ExerciseLicense[];

const CC_LICENSES = [
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-SA-3.0',
  'CC-BY-SA-4.0',
] as const satisfies readonly CreativeCommonsLicense[];

const PROVIDERS = ['nutry'] as const satisfies readonly ExerciseProvider[];

export const VIDEO_PROVIDERS = [
  'mixkit',
  'coverr',
  'wikimedia',
] as const satisfies readonly VideoProvider[];
export const VIDEO_LICENSES = [
  ...EXERCISE_LICENSES,
  ...CC_LICENSES,
  'Mixkit',
  'Coverr',
] as const satisfies readonly VideoLicense[];

/** Hôte de la page d'origine attendu pour chaque fournisseur de vidéo. */
export const VIDEO_SOURCE_HOSTS: Readonly<Record<VideoProvider, string>> = {
  mixkit: 'mixkit.co',
  coverr: 'coverr.co',
  wikimedia: 'commons.wikimedia.org',
};

const VIDEO_OWN_LICENSE: Readonly<Partial<Record<VideoProvider, VideoLicense>>> = {
  mixkit: 'Mixkit',
  coverr: 'Coverr',
};

/** Vidéos courtes et légères : la fiche reste rapide, même en 4G. */
export const VIDEO_LIMITS = { maxSeconds: 60, maxKb: 1500 } as const;

/** Schémas où une série se mesure en secondes plutôt qu'en répétitions. */
const DURATION_PATTERNS: readonly MovementPattern[] = [
  'gainage',
  'cardio',
  'mobilite',
  'equilibre',
];

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const id = z.string().regex(ID_PATTERN, 'identifiant attendu en kebab-case ASCII');
const text = (max: number) => z.string().trim().min(1).max(max);
const uniqueList = <T extends z.ZodType>(item: T, minLength = 0) =>
  z
    .array(item)
    .min(minLength)
    .refine((values) => new Set(values).size === values.length, 'valeurs en double');

const httpsUrl = z.string().refine((value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, 'adresse https attendue');
const hostOf = (url: string): string => new URL(url).hostname;

const imageSchema = z
  .object({
    /** Chemin relatif à `public/` : `exercices/<id>-<n>.webp`. */
    file: z.string().regex(/^exercices\/[a-z0-9-]+\.webp$/, 'exercices/<id>-<n>.webp attendu'),
    width: z.number().int().min(200).max(1200),
    height: z.number().int().min(150).max(1200),
    alt: text(160),
    author: text(120),
    license: z.enum(EXERCISE_LICENSES),
  })
  .strict();

/** MP4 auto-hébergé dans `public/exercices/videos/`, avec son crédit. */
const videoSchema = z
  .object({
    file: z
      .string()
      .regex(/^exercices\/videos\/[a-z0-9-]+\.mp4$/, 'exercices/videos/<id>-<n>.mp4 attendu'),
    poster: z
      .string()
      .regex(/^exercices\/videos\/[a-z0-9-]+\.webp$/, 'affiche .webp attendue')
      .optional(),
    durationSeconds: z.number().int().min(2).max(VIDEO_LIMITS.maxSeconds),
    sizeKb: z.number().int().positive().max(VIDEO_LIMITS.maxKb),
    provider: z.enum(VIDEO_PROVIDERS),
    author: text(120),
    license: z.enum(VIDEO_LICENSES),
    sourceUrl: httpsUrl,
  })
  .strict()
  .superRefine((video, ctx) => {
    if (hostOf(video.sourceUrl) !== VIDEO_SOURCE_HOSTS[video.provider]) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceUrl'],
        message: `page ${VIDEO_SOURCE_HOSTS[video.provider]} attendue`,
      });
    }
    // Mixkit et Coverr ont leur propre licence ; les autres sources, une licence Creative Commons.
    const expected = VIDEO_OWN_LICENSE[video.provider];
    const ownLicense = video.license === 'Mixkit' || video.license === 'Coverr';
    if (expected === undefined ? ownLicense : video.license !== expected) {
      ctx.addIssue({
        code: 'custom',
        path: ['license'],
        message: 'licence incohérente avec la source',
      });
    }
  });

/**
 * Seul lien sortant permis : une recherche YouTube (`/results?search_query=…`). Aucun autre
 * site, aucune vidéo YouTube précise (lien qui casse, contenu non vérifié).
 */
const youtubeSearchUrl = httpsUrl.refine((value) => {
  const url = new URL(value);
  return (
    url.hostname === 'www.youtube.com' &&
    url.pathname === '/results' &&
    (url.searchParams.get('search_query') ?? '').length > 0
  );
}, 'recherche YouTube attendue (www.youtube.com/results?search_query=…)');

const creditSchema = z
  .object({
    provider: z.enum(PROVIDERS),
    sourceUrl: httpsUrl.optional(),
    authors: uniqueList(text(120), 1).refine((a) => a.length <= 10, '10 auteurs au plus'),
    license: z.enum(EXERCISE_LICENSES),
    modified: text(200),
  })
  .strict()
  .superRefine((credit, ctx) => {
    if (credit.sourceUrl !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['sourceUrl'], message: 'contenu Nutry sans source' });
    }
  });

export const exerciseEntrySchema = z
  .object({
    id,
    name: text(80),
    kind: z.enum(EXERCISE_KINDS),
    pattern: z.enum(MOVEMENT_PATTERNS),
    /** Clé de pose du mannequin (ex. `squat`), partagée par plusieurs exercices. */
    movement: id,
    primaryMuscles: uniqueList(z.enum(MUSCLE_GROUPS)),
    secondaryMuscles: uniqueList(z.enum(MUSCLE_GROUPS)),
    equipment: uniqueList(z.enum(EQUIPMENT)),
    level: z.enum(TRAINING_LEVELS),
    measure: z.enum(EXERCISE_MEASURES),
    unilateral: z.boolean(),
    tags: uniqueList(z.enum(EXERCISE_TAGS)),
    instructions: z.array(text(400)).min(1).max(12),
    tips: z.array(text(300)).max(8),
    easierId: id.optional(),
    harderId: id.optional(),
    images: z.array(imageSchema).max(4),
    videos: z.array(videoSchema).max(2),
    /** Recherche YouTube ; absente : l'adaptateur la construit depuis le nom. */
    youtubeSearchUrl: youtubeSearchUrl.optional(),
    credit: creditSchema,
  })
  .strict()
  .superRefine((entry, ctx) => {
    const issue = (path: string, message: string) => {
      ctx.addIssue({ code: 'custom', path: [path], message });
    };
    if (entry.kind !== PATTERN_KIND[entry.pattern]) {
      issue('kind', `nature attendue pour ${entry.pattern} : ${PATTERN_KIND[entry.pattern]}`);
    }
    if (entry.kind === 'force' && entry.primaryMuscles.length === 0) {
      issue('primaryMuscles', 'au moins un muscle');
    }
    // Cardio, mobilité et équilibre n'ont aucun muscle principal permis : le planificateur
    // écarterait l'exercice (`isExerciseEligible`) ; leurs muscles vont en secondaire.
    const allowed = PATTERN_PRIMARY_GROUPS[entry.pattern];
    const outside = entry.primaryMuscles.filter((m) => !allowed.includes(m));
    if (outside.length > 0) {
      issue('primaryMuscles', `hors du schéma ${entry.pattern} : ${outside.join(', ')}`);
    }
    if (entry.primaryMuscles.some((m) => entry.secondaryMuscles.includes(m))) {
      issue('secondaryMuscles', 'muscle à la fois principal et secondaire');
    }
    if (entry.measure === 'duree' && !DURATION_PATTERNS.includes(entry.pattern)) {
      issue('measure', `pas de série en durée pour ${entry.pattern}`);
    }
    if (entry.easierId === entry.id || entry.harderId === entry.id) {
      issue('easierId', 'un exercice n’est pas sa propre variante');
    }
  });

export type ExerciseEntry = z.infer<typeof exerciseEntrySchema>;

/** Fichier complet : en-tête de provenance et exercices, avec contrôles croisés. */
export const exerciseCatalogFileSchema = z
  .object({
    version: z.literal(1),
    source: z
      .object({
        name: z.literal('nutry'),
        license: z.literal('MIT'),
      })
      .strict(),
    exercises: z.array(exerciseEntrySchema).min(1).max(1000),
  })
  .strict()
  .superRefine((file, ctx) => {
    const byId = new Map<string, ExerciseEntry>();
    const files = new Set<string>();
    const mediaFiles = (entry: ExerciseEntry) => [
      ...entry.images.map((i) => i.file),
      ...entry.videos.flatMap((v) => (v.poster === undefined ? [v.file] : [v.file, v.poster])),
    ];
    file.exercises.forEach((entry, index) => {
      if (byId.has(entry.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['exercises', index, 'id'],
          message: `identifiant en double : ${entry.id}`,
        });
      }
      byId.set(entry.id, entry);
      for (const media of mediaFiles(entry)) {
        if (files.has(media)) {
          ctx.addIssue({
            code: 'custom',
            path: ['exercises', index],
            message: `fichier en double : ${media}`,
          });
        }
        files.add(media);
      }
    });
    file.exercises.forEach((entry, index) => {
      for (const key of ['easierId', 'harderId'] as const) {
        const target = entry[key];
        if (target === undefined) continue;
        const variant = byId.get(target);
        if (variant?.pattern !== entry.pattern) {
          ctx.addIssue({
            code: 'custom',
            path: ['exercises', index, key],
            message: `variante inconnue ou d’un autre schéma : ${target}`,
          });
        }
      }
    });
  });

export type ExerciseCatalogFile = z.infer<typeof exerciseCatalogFileSchema>;

// --------------------------------------------- Alignement à la compilation sur le domain

type Plain<T> = T extends readonly (infer U)[]
  ? Plain<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Plain<Exclude<T[K], undefined>> }
    : T;
type Assignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Same<A, B> = Assignable<A, B> extends true ? Assignable<keyof A, keyof B> : false;
type AssertTrue<T extends true> = T;

/** Une entrée, privée de ses médias et de son crédit, est exactement un `Exercise`. */
export type ExerciseEntryMatchesDomain = AssertTrue<
  Same<
    Plain<Omit<ExerciseEntry, 'images' | 'videos' | 'youtubeSearchUrl' | 'credit'>>,
    Plain<Exercise>
  >
>;
