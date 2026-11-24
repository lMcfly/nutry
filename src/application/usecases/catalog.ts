import type { Recipe } from '@domain/recipe';
import type { IsoDate } from '@domain/shared';
import type { AppPorts } from './context';

/** Textes de l'écran « Crédits photos » (ADR 0010 : indissociables de l'exigence de licence). */
export const PHOTO_CREDITS_TEXTS = {
  title: 'Crédits photos',
  subtitle: 'Des photos libres, avec leurs auteurs.',
  intro:
    'Les photos des plats viennent de Wikimedia Commons, sous licences libres. Merci à leurs auteurs.',
  modified: 'modifiée : recadrée et compressée',
  illustrative: 'photo d’illustration',
  source: 'Source : Wikimedia Commons',
  empty: 'Aucune photo pour le moment.',
} as const;

/** Une ligne de l'écran « Crédits photos ». */
export interface PhotoCreditView {
  readonly recipeId: string;
  /** Nom du plat tel qu'affiché dans l'app. */
  readonly dishName: string;
  readonly author: string;
  /** Licence lisible (`Domaine public` pour `PD`). */
  readonly licenseLabel: string;
  readonly licenseUrl: string;
  readonly sourceUrl: string;
  readonly modified: string;
  /** Photo d'un plat voisin plutôt que de ce plat exactement. */
  readonly illustrative: boolean;
}

export interface CatalogUseCases {
  /** Une recette du catalogue par identifiant (détail recette, liens profonds). */
  readonly getRecipe: (id: string) => Promise<Recipe | undefined>;
  /** Jour calendaire LOCAL de l'appareil (`AAAA-MM-JJ`), via le port Clock. */
  readonly today: () => IsoDate;
  /** Adresse de la photo de chaque plat qui en a une, par identifiant de recette. */
  readonly getPhotoUrls: () => Promise<Readonly<Record<string, string>>>;
  /** Crédits de toutes les photos, par ordre alphabétique des plats. */
  readonly listPhotoCredits: () => Promise<readonly PhotoCreditView[]>;
}

/** `PD` est la façon courte de noter le domaine public dans les données. */
export function licenseLabel(license: string): string {
  return license === 'PD' ? 'Domaine public' : license;
}

export function createCatalogUseCases(ports: AppPorts): CatalogUseCases {
  return {
    getRecipe: (id) => ports.recipes.getById(id),
    today: () => ports.clock.today(),

    async getPhotoUrls() {
      const photos = await ports.photos.getAll();
      return Object.fromEntries(photos.map((p) => [p.recipeId, p.url]));
    },

    async listPhotoCredits() {
      const [photos, recipes] = await Promise.all([ports.photos.getAll(), ports.recipes.getAll()]);
      const names = new Map(recipes.map((r) => [r.id, r.name]));
      return photos
        .flatMap((photo): PhotoCreditView[] => {
          const dishName = names.get(photo.recipeId);
          // Une photo dont la recette a quitté le catalogue n'est plus affichée nulle part.
          if (dishName === undefined) return [];
          return [
            {
              recipeId: photo.recipeId,
              dishName,
              author: photo.author,
              licenseLabel: licenseLabel(photo.license),
              licenseUrl: photo.licenseUrl,
              sourceUrl: photo.sourceUrl,
              modified: photo.modified,
              illustrative: photo.approximate,
            },
          ];
        })
        .sort((a, b) => a.dishName.localeCompare(b.dishName, 'fr'));
    },
  };
}
