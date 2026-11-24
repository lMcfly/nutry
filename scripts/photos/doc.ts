/**
 * Génère docs/PHOTOS.md (liste des photos, auteurs et licences) à partir de
 * src/infrastructure/data/photoCredits.json et recipes.json : `npm run photos:doc`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface PhotoCredit {
  readonly provider: 'wikimedia' | 'foodiesfeed' | 'unsplash';
  readonly recipeId: string;
  /** Photos locales (`public/photos`) seulement. */
  readonly file?: string;
  /** Photos Unsplash seulement : page de l'auteur. */
  readonly authorUrl?: string;
  readonly title: string;
  readonly author: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly sourceUrl: string;
  readonly modified: string;
  readonly matchQuality: string;
}

const fromRoot = (path: string): string => fileURLToPath(new URL(`../../${path}`, import.meta.url));
export const CREDITS_PATH = fromRoot('src/infrastructure/data/photoCredits.json');
export const RECIPES_PATH = fromRoot('src/infrastructure/data/recipes.json');
export const UNSPLASH_HOME = 'https://unsplash.com/?utm_source=nutry&utm_medium=referral';
export const DOC_PATH = fromRoot('docs/PHOTOS.md');

const PROVIDER_LABELS: Record<PhotoCredit['provider'], string> = {
  wikimedia: 'Wikimedia Commons',
  foodiesfeed: 'Foodiesfeed',
  unsplash: 'Unsplash',
};

/** Une cellule de tableau Markdown : sans barre verticale ni retour à la ligne. */
const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

export function renderPhotosDoc(
  credits: readonly PhotoCredit[],
  recipeNames: ReadonlyMap<string, string>,
): string {
  const count = (provider: PhotoCredit['provider']): number =>
    credits.filter((c) => c.provider === provider).length;
  const rows = [...credits]
    .map((c) => ({ c, name: recipeNames.get(c.recipeId) ?? c.recipeId }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map(({ c, name }) =>
      [
        cell(name),
        PROVIDER_LABELS[c.provider],
        c.file ? `\`${c.file}\`` : 'distante',
        c.provider === 'unsplash' && c.authorUrl
          ? `Photo de [${cell(c.author)}](${c.authorUrl}) sur [Unsplash](${UNSPLASH_HOME})`
          : cell(c.author),
        `[${cell(c.license)}](${c.licenseUrl})`,
        `[${cell(c.title)}](${c.sourceUrl})`,
        c.matchQuality === 'exact' ? 'exacte' : 'illustration',
      ].join(' | '),
    )
    .map((row) => `| ${row} |`);
  return [
    '# Crédits photos',
    '',
    '<!-- Fichier généré par `npm run photos:doc` : ne pas modifier à la main. -->',
    '',
    `Les ${credits.length} photos de plats viennent de trois sources :`,
    '',
    `- **Foodiesfeed** (${count('foodiesfeed')} photos, [CC0](https://creativecommons.org/publicdomain/zero/1.0/)) :`,
    '  recadrées en 800 × 600, compressées en WebP et servies par l’app (`public/photos/`).',
    `- **[Unsplash](${UNSPLASH_HOME})** (${count('unsplash')} photos, [licence Unsplash](https://unsplash.com/license)) :`,
    '  **non téléchargées**, chargées depuis `images.unsplash.com` (hotlink exigé par les règles de l’API),',
    '  rognées en 4:3 par leur CDN. Attribution : « Photo de *auteur* sur Unsplash », avec les deux liens.',
    `- **[Wikimedia Commons](https://commons.wikimedia.org/)** (${count('wikimedia')} photos, CC0, domaine public, CC BY, CC BY-SA) :`,
    '  recadrées et compressées comme celles de Foodiesfeed ; elles sont donc **modifiées** par rapport à',
    '  l’original (mention exigée par CC BY-SA).',
    '',
    'La même liste est consultable dans l’app : Profil → Confidentialité → Crédits photos.',
    '',
    'Les plats absents de la liste gardent leur illustration dessinée. « Illustration » indique une photo',
    'd’un plat voisin, pas de ce plat exactement.',
    '',
    '| Plat | Source | Fichier | Auteur | Licence | Photo | Correspondance |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

export function loadInputs(): {
  credits: PhotoCredit[];
  names: Map<string, string>;
} {
  const credits = JSON.parse(readFileSync(CREDITS_PATH, 'utf8')) as PhotoCredit[];
  const recipes = JSON.parse(readFileSync(RECIPES_PATH, 'utf8')) as { id: string; name: string }[];
  return { credits, names: new Map(recipes.map((r) => [r.id, r.name])) };
}

function main(): void {
  const { credits, names } = loadInputs();
  writeFileSync(DOC_PATH, renderPhotosDoc(credits, names));
  console.log(`docs/PHOTOS.md (${credits.length} photos)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
