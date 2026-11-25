import type {
  ExerciseCatalog,
  ExerciseCredit,
  ExerciseImage,
  ExerciseLink,
  ExerciseMedia,
  ExerciseVideo,
} from '@application/ports';
import type { Exercise } from '@domain/training';
import { EXERCISE_LICENSE_URLS, VIDEO_LICENSE_URLS } from '../data/exerciseLicenses';
import type { ExerciseCatalogFile, ExerciseEntry } from '../data/exerciseSchemas';

/** Charge et valide le catalogue embarqué ; rejette avec un message clair s'il est invalide. */
export type ExerciseFileLoader = () => Promise<ExerciseCatalogFile>;

/**
 * Catalogue embarqué : le JSON et Zod sont chargés à la demande (import dynamique, morceau
 * séparé du bundle), puis validés une fois par session.
 */
export const loadEmbeddedExercises: ExerciseFileLoader = async () => {
  const [{ exerciseCatalogFileSchema }, data] = await Promise.all([
    import('../data/exerciseSchemas'),
    import('../data/exercises.json'),
  ]);
  const result = exerciseCatalogFileSchema.safeParse(data.default);
  if (!result.success) {
    const detail = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.map(String).join('.')}: ${i.message}`)
      .join(' ; ');
    throw new Error(`Catalogue d’exercices invalide : ${detail}`);
  }
  return result.data;
};

/** Le domain ne voit ni média, ni crédit, ni lien : on les retire de l'entrée. */
export function toExercise(entry: ExerciseEntry): Exercise {
  return {
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    pattern: entry.pattern,
    movement: entry.movement,
    primaryMuscles: entry.primaryMuscles,
    secondaryMuscles: entry.secondaryMuscles,
    equipment: entry.equipment,
    level: entry.level,
    measure: entry.measure,
    unilateral: entry.unilateral,
    tags: entry.tags,
    instructions: entry.instructions,
    tips: entry.tips,
    ...(entry.easierId === undefined ? {} : { easierId: entry.easierId }),
    ...(entry.harderId === undefined ? {} : { harderId: entry.harderId }),
  };
}

/** Recherche YouTube par défaut : le nom de l'exercice (seul lien sortant, ADR 0015). */
export function youtubeSearchFor(name: string): string {
  const query = new URLSearchParams({ search_query: `${name} tuto` });
  return `https://www.youtube.com/results?${query.toString()}`;
}

/**
 * Exercices du catalogue Nutry : sépare l'`Exercise` du domain de ses médias (images,
 * vidéos, lien de recherche, crédit). `baseUrl` est `import.meta.env.BASE_URL` ; les médias
 * sont servis par l'app elle-même sous `<base><fichier>`.
 */
export class StaticExerciseCatalog implements ExerciseCatalog {
  private loaded: Promise<ReadonlyMap<string, ExerciseEntry>> | undefined;

  constructor(
    private readonly baseUrl: string,
    private readonly load: ExerciseFileLoader = loadEmbeddedExercises,
  ) {}

  private entries(): Promise<ReadonlyMap<string, ExerciseEntry>> {
    this.loaded ??= this.load().then(
      (file) => new Map(file.exercises.map((entry) => [entry.id, entry])),
      (error: unknown) => {
        // Pas de catalogue : l'écran le dit ; nouvel essai possible au prochain appel.
        this.loaded = undefined;
        throw error;
      },
    );
    return this.loaded;
  }

  async getExercises(): Promise<readonly Exercise[]> {
    return [...(await this.entries()).values()].map(toExercise);
  }

  async getMedia(exerciseId: string): Promise<ExerciseMedia | undefined> {
    const entry = (await this.entries()).get(exerciseId);
    return entry === undefined ? undefined : this.mediaOf(entry);
  }

  private mediaOf(entry: ExerciseEntry): ExerciseMedia {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const images: ExerciseImage[] = entry.images.map((image) => ({
      src: `${base}${image.file}`,
      width: image.width,
      height: image.height,
      alt: image.alt,
      author: image.author,
      license: image.license,
    }));
    const videos: ExerciseVideo[] = entry.videos.map((video) => ({
      src: `${base}${video.file}`,
      ...(video.poster === undefined ? {} : { poster: `${base}${video.poster}` }),
      durationSeconds: video.durationSeconds,
      provider: video.provider,
      author: video.author,
      license: video.license,
      licenseUrl: VIDEO_LICENSE_URLS[video.license],
      sourceUrl: video.sourceUrl,
    }));
    const links: ExerciseLink[] = [
      { kind: 'youtube', url: entry.youtubeSearchUrl ?? youtubeSearchFor(entry.name) },
    ];
    const credit: ExerciseCredit = {
      provider: entry.credit.provider,
      authors: entry.credit.authors,
      license: entry.credit.license,
      licenseUrl: EXERCISE_LICENSE_URLS[entry.credit.license],
      modified: entry.credit.modified,
    };
    return { exerciseId: entry.id, images, videos, links, credit };
  }
}
