import type { Recipe } from '@domain/recipe';
import type { IsoDate } from '@domain/shared';
import type { PhotoProvider } from '../ports';
import type { AppPorts } from './context';

/** Textes de l'écran « Crédits photos » (ADR 0010 : indissociables de l'exigence de licence). */
export const PHOTO_CREDITS_TEXTS = {
  title: 'Crédits photos',
  subtitle: 'Des photos libres, avec leurs auteurs.',
  intro:
    'Les photos des plats viennent de Foodiesfeed (CC0), d’Unsplash (licence Unsplash) et de Wikimedia Commons (licences libres). Merci à leurs auteurs.',
  modified: 'modifiée : recadrée et compressée',
  illustrative: 'photo d’illustration',
  sourceByProvider: {
    wikimedia: 'Source : Wikimedia Commons',
    foodiesfeed: 'Source : Foodiesfeed',
    unsplash: 'Photo sur Unsplash',
  },
  /** « Photo de <auteur> sur Unsplash » : les deux liens sont exigés par les règles de l'API Unsplash. */
  unsplashBy: 'Photo de',
  unsplashOn: 'sur',
  unsplashName: 'Unsplash',
  unsplashHomeUrl: 'https://unsplash.com/?utm_source=nutry&utm_medium=referral',
  empty: 'Aucune photo pour le moment.',
} as const;

/** Une ligne de l'écran « Crédits photos ». */
export interface PhotoCreditView {
  readonly recipeId: string;
  /** Nom du plat tel qu'affiché dans l'app. */
  readonly dishName: string;
  readonly provider: PhotoProvider;
  readonly author: string;
  /** Page de l'auteur (Unsplash). */
  readonly authorUrl?: string | undefined;
  /** Licence lisible (`Domaine public` pour `PD`). */
  readonly licenseLabel: string;
  readonly licenseUrl: string;
  readonly sourceUrl: string;
  readonly modified: string;
  /** Photo d'un plat voisin plutôt que de ce plat exactement. */
  readonly illustrative: boolean;
}

/** Ce qu'il faut à une balise `<img>` : l'adresse, et ses variantes de largeur s'il y en a. */
export interface PhotoImage {
  readonly src: string;
  readonly srcSet?: string | undefined;
}

export interface CatalogUseCases {
  /** Une recette du catalogue par identifiant (détail recette, liens profonds). */
  readonly getRecipe: (id: string) => Promise<Recipe | undefined>;
  /** Jour calendaire LOCAL de l'appareil (`AAAA-MM-JJ`), via le port Clock. */
  readonly today: () => IsoDate;
  /** Image de chaque plat qui en a une (adresse et variantes), par identifiant de recette. */
  readonly getPhotoImages: () => Promise<Readonly<Record<string, PhotoImage>>>;
  /** Crédits de toutes les photos, par ordre alphabétique des plats. */
  readonly listPhotoCredits: () => Promise<readonly PhotoCreditView[]>;
}

/** `PD` : domaine public ; `Unsplash` : la licence propre à Unsplash. */
export function licenseLabel(license: string): string {
  if (license === 'PD') return 'Domaine public';
  return license === 'Unsplash' ? 'Licence Unsplash' : license;
}

export function createCatalogUseCases(ports: AppPorts): CatalogUseCases {
  return {
    getRecipe: (id) => ports.recipes.getById(id),
    today: () => ports.clock.today(),

    async getPhotoImages() {
      const photos = await ports.photos.getAll();
      return Object.fromEntries(
        photos.map((p) => [p.recipeId, { src: p.src, srcSet: p.srcSet } satisfies PhotoImage]),
      );
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
              provider: photo.provider,
              author: photo.author,
              authorUrl: photo.authorUrl,
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
