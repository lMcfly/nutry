import type { PhotoCatalog, RecipePhoto } from '@application/ports';

interface PhotoCreditBase {
  readonly recipeId: string;
  readonly title: string;
  readonly author: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly sourceUrl: string;
  readonly modified: string;
  readonly matchQuality: 'exact' | 'approchant';
}

/** Photo servie par l'app elle-même (`public/photos/<file>`). */
export interface LocalPhotoCredit extends PhotoCreditBase {
  readonly provider: 'wikimedia' | 'foodiesfeed';
  readonly file: string;
}

/** Point de cadrage d'Unsplash : `x` et `y` de 0 à 1, `z` (zoom) facultatif, au moins 1. */
export interface PhotoFocal {
  readonly x: number;
  readonly y: number;
  readonly z?: number | undefined;
}

/** Photo chargée depuis le CDN d'Unsplash (hotlink obligatoire : jamais téléchargée). */
export interface UnsplashPhotoCredit extends PhotoCreditBase {
  readonly provider: 'unsplash';
  /** Adresse `https://images.unsplash.com/photo-…?ixid=…` fournie par l'API, sans taille. */
  readonly rawUrl: string;
  readonly focal: PhotoFocal;
  readonly authorUrl: string;
}

/** Une entrée de `data/photoCredits.json` (voir docs/PHOTOS.md). */
export type PhotoCreditRecord = LocalPhotoCredit | UnsplashPhotoCredit;

/** Largeurs servies par Unsplash (rendu 4:3) ; `src` est la médiane. */
export const UNSPLASH_WIDTHS = [400, 800, 1200] as const;
const UNSPLASH_SRC_WIDTH = 800;

/** Adresse d'une image Unsplash de largeur `width`, rognée en 4:3 autour du point de cadrage. */
export function unsplashImageUrl(rawUrl: string, focal: PhotoFocal, width: number): string {
  const params = [
    `w=${width}`,
    `h=${Math.round((width * 3) / 4)}`,
    'fit=crop',
    'crop=focalpoint',
    `fp-x=${focal.x}`,
    `fp-y=${focal.y}`,
    ...(focal.z === undefined ? [] : [`fp-z=${focal.z}`]),
    'q=75',
    'fm=webp',
    'auto=format',
  ];
  return `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}${params.join('&')}`;
}

export type PhotoCreditsLoader = () => Promise<readonly PhotoCreditRecord[]>;

/** Les crédits sont chargés à la demande : ils sortent du paquet initial. */
export const loadEmbeddedPhotoCredits: PhotoCreditsLoader = async () => {
  const data = await import('../data/photoCredits.json');
  return data.default as readonly PhotoCreditRecord[];
};

/** Texte brut : sans balise, entités ni espaces superflus (les auteurs viennent de Commons). */
export function toPlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Photos des plats : celles de `public/photos` sont servies par l'app sous
 * `<base>photos/<fichier>.webp` (hors précache : voir vite.config.ts) ; celles d'Unsplash
 * viennent de leur CDN, avec `srcset`. `baseUrl` est `import.meta.env.BASE_URL`.
 */
export class StaticPhotoCatalog implements PhotoCatalog {
  private all: Promise<readonly RecipePhoto[]> | undefined;

  constructor(
    private readonly baseUrl: string,
    private readonly load: PhotoCreditsLoader = loadEmbeddedPhotoCredits,
  ) {}

  getAll(): Promise<readonly RecipePhoto[]> {
    this.all ??= this.load().then(
      (records) =>
        records.map((r): RecipePhoto => {
          const common = {
            recipeId: r.recipeId,
            provider: r.provider,
            title: toPlainText(r.title),
            author: toPlainText(r.author),
            license: toPlainText(r.license),
            licenseUrl: r.licenseUrl,
            sourceUrl: r.sourceUrl,
            modified: toPlainText(r.modified),
            approximate: r.matchQuality === 'approchant',
          };
          if (r.provider === 'unsplash') {
            return {
              ...common,
              authorUrl: r.authorUrl,
              src: unsplashImageUrl(r.rawUrl, r.focal, UNSPLASH_SRC_WIDTH),
              srcSet: UNSPLASH_WIDTHS.map(
                (w) => `${unsplashImageUrl(r.rawUrl, r.focal, w)} ${w}w`,
              ).join(', '),
            };
          }
          const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
          return { ...common, src: `${base}photos/${r.file}` };
        }),
      (error: unknown) => {
        // Pas de photo vaut mieux qu'un écran cassé : repli sur les illustrations, nouvel essai possible.
        this.all = undefined;
        throw error;
      },
    );
    return this.all;
  }
}
