/**
 * Génère docs/PHOTOS.md (liste des photos, auteurs et licences) à partir de
 * src/infrastructure/data/photoCredits.json et recipes.json : `npm run photos:doc`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface PhotoCredit {
  readonly recipeId: string;
  readonly file: string;
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
export const DOC_PATH = fromRoot('docs/PHOTOS.md');

/** Une cellule de tableau Markdown : sans barre verticale ni retour à la ligne. */
const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

export function renderPhotosDoc(
  credits: readonly PhotoCredit[],
  recipeNames: ReadonlyMap<string, string>,
): string {
  const rows = [...credits]
    .map((c) => ({ c, name: recipeNames.get(c.recipeId) ?? c.recipeId }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map(({ c, name }) =>
      [
        cell(name),
        `\`${c.file}\``,
        cell(c.author),
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
    `Les ${credits.length} photos de plats de \`public/photos/\` viennent de [Wikimedia Commons](https://commons.wikimedia.org/)`,
    'sous licences libres (CC0, domaine public, CC BY, CC BY-SA). Chaque image est recadrée en 800 × 600 et',
    'compressée en WebP : elle est donc **modifiée** par rapport à l’original (mention exigée par CC BY-SA).',
    'La même liste est consultable dans l’app : Profil → Confidentialité → Crédits photos.',
    '',
    'Les plats absents de la liste gardent leur illustration dessinée. « Illustration » indique une photo',
    'd’un plat voisin, pas de ce plat exactement.',
    '',
    '| Plat | Fichier | Auteur | Licence | Source | Correspondance |',
    '| --- | --- | --- | --- | --- | --- |',
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
