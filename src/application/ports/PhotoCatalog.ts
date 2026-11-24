/** Photo libre d'un plat, avec ce qu'exige sa licence (auteur, licence, source, modification). */
export interface RecipePhoto {
  readonly recipeId: string;
  /** Adresse de l'image (servie par l'app elle-même : même origine). */
  readonly url: string;
  /** Titre du fichier sur Wikimedia Commons. */
  readonly title: string;
  readonly author: string;
  /** `CC0`, `PD`, `CC BY 4.0`, `CC BY-SA 3.0`… */
  readonly license: string;
  readonly licenseUrl: string;
  readonly sourceUrl: string;
  /** Modification apportée à l'original (exigence CC BY-SA). */
  readonly modified: string;
  /** Photo d'un plat voisin plutôt que de ce plat exactement. */
  readonly approximate: boolean;
}

/** Photos embarquées dans l'app (lecture seule). Une recette peut ne pas en avoir. */
export interface PhotoCatalog {
  getAll(): Promise<readonly RecipePhoto[]>;
}
