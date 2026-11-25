import type { Exercise } from '@domain/training';

/** Origine d'une fiche : la base wger (CC BY-SA) ou un mouvement rédigé pour Nutry. */
export type ExerciseProvider = 'wger' | 'nutry';

/** Licences admises pour les textes et les images d'exercices (ADR 0015). */
export type ExerciseLicense = 'CC0-1.0' | 'CC-BY-4.0' | 'CC-BY-SA-3.0' | 'CC-BY-SA-4.0';

/** Image d'un exercice, servie par l'app elle-même (`img-src 'self'`). */
export interface ExerciseImage {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly author: string;
  readonly license: ExerciseLicense;
}

/** Origine d'une vidéo libre, auto-hébergée en MP4 court et compressé. */
export type VideoProvider = 'wger' | 'mixkit' | 'coverr' | 'wikimedia';

/**
 * Licences des vidéos : celles des fiches, plus les licences propres à Mixkit et Coverr
 * (usage libre, sans attribution exigée ; on crédite quand même).
 */
export type VideoLicense = ExerciseLicense | 'Mixkit' | 'Coverr';

/** Vidéo de démonstration, servie par l'app elle-même (`media-src 'self'`), jamais intégrée d'ailleurs. */
export interface ExerciseVideo {
  readonly src: string;
  /** Image affichée avant lecture (`poster`). */
  readonly poster?: string | undefined;
  readonly durationSeconds: number;
  readonly provider: VideoProvider;
  readonly author: string;
  readonly license: VideoLicense;
  readonly licenseUrl: string;
  readonly sourceUrl: string;
}

/**
 * Seul lien sortant : une recherche YouTube sur le nom de l'exercice, ouverte dans un nouvel
 * onglet (`rel="noopener noreferrer"`). Ni iframe ni lecture intégrée (CSP inchangée).
 */
export interface ExerciseLink {
  readonly kind: 'youtube';
  readonly url: string;
}

/** Ce qu'exige la licence de la fiche (texte et métadonnées). */
export interface ExerciseCredit {
  readonly provider: ExerciseProvider;
  /** Page de la fiche d'origine (wger) ; absente pour un mouvement Nutry. */
  readonly sourceUrl?: string | undefined;
  readonly authors: readonly string[];
  readonly license: ExerciseLicense;
  readonly licenseUrl: string;
  /** Modification apportée à l'original (exigence CC BY-SA). */
  readonly modified: string;
}

/** Tout ce que la fiche « Voir le tuto » affiche en plus de l'exercice du domain. */
export interface ExerciseMedia {
  readonly exerciseId: string;
  readonly images: readonly ExerciseImage[];
  readonly videos: readonly ExerciseVideo[];
  readonly links: readonly ExerciseLink[];
  readonly credit: ExerciseCredit;
}

/** Catalogue d'exercices embarqué (lecture seule, chargé à la demande). */
export interface ExerciseCatalog {
  getExercises(): Promise<readonly Exercise[]>;
  getMedia(exerciseId: string): Promise<ExerciseMedia | undefined>;
}
