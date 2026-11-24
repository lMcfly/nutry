import type { PhotoCatalog, RecipePhoto } from '@application/ports';

/** Une entrée de `data/photoCredits.json` (voir docs/PHOTOS.md). */
export interface PhotoCreditRecord {
  readonly recipeId: string;
  readonly file: string;
  readonly title: string;
  readonly author: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly sourceUrl: string;
  readonly modified: string;
  readonly matchQuality: 'exact' | 'approchant';
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
 * Photos servies par l'app sous `<base>photos/<fichier>.webp` (dossier `public/photos`,
 * hors précache : voir vite.config.ts). `baseUrl` est `import.meta.env.BASE_URL`.
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
        records.map((r) => ({
          recipeId: r.recipeId,
          url: `${this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`}photos/${r.file}`,
          title: toPlainText(r.title),
          author: toPlainText(r.author),
          license: toPlainText(r.license),
          licenseUrl: r.licenseUrl,
          sourceUrl: r.sourceUrl,
          modified: toPlainText(r.modified),
          approximate: r.matchQuality === 'approchant',
        })),
      (error: unknown) => {
        // Pas de photo vaut mieux qu'un écran cassé : repli sur les illustrations, nouvel essai possible.
        this.all = undefined;
        throw error;
      },
    );
    return this.all;
  }
}
