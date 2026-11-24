/** D'où vient une photo : ce qui détermine ses crédits et, côté infrastructure, comment elle est servie. */
export type PhotoProvider = 'wikimedia' | 'foodiesfeed' | 'unsplash';

/** Photo libre d'un plat, avec ce qu'exige sa licence (auteur, licence, source, modification). */
export interface RecipePhoto {
  readonly recipeId: string;
  readonly provider: PhotoProvider;
  /** Adresse de l'image : celle de l'app elle-même, ou (Unsplash) son CDN. */
  readonly src: string;
  /** Variantes de largeur (`400w, 800w…`) quand le fournisseur sait redimensionner. */
  readonly srcSet?: string | undefined;
  /** Titre du fichier (Wikimedia, Foodiesfeed) ou description de la photo (Unsplash). */
  readonly title: string;
  readonly author: string;
  /** Page de l'auteur (Unsplash). */
  readonly authorUrl?: string | undefined;
  /** `CC0`, `PD`, `CC BY 4.0`, `CC BY-SA 3.0`, `Unsplash`… */
  readonly license: string;
  readonly licenseUrl: string;
  readonly sourceUrl: string;
  /** Modification apportée à l'original (exigence CC BY-SA). */
  readonly modified: string;
  /** Photo d'un plat voisin plutôt que de ce plat exactement. */
  readonly approximate: boolean;
}

/** Photos des plats (lecture seule). Une recette peut ne pas en avoir. */
export interface PhotoCatalog {
  getAll(): Promise<readonly RecipePhoto[]>;
}
