/**
 * Normalisation de texte pour comparer des noms d'aliments saisis librement :
 * minuscules, sans accents ni ligatures, ponctuation remplacée par des espaces.
 * `normalizeText("Pavé de Saumon")` → `"pave de saumon"`.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Forme « racine » d'un mot : retire le pluriel simple (-s, -x) des mots de plus de 3 lettres. */
function stem(word: string): string {
  return word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word;
}

const TOKEN_CACHE = new Map<string, readonly string[]>();
const TOKEN_CACHE_LIMIT = 10_000;

/**
 * Mots normalisés et ramenés au singulier simple.
 * Mémoïsé (cache borné, sans effet observable) : le scoring compare des milliers de noms.
 */
export function tokenize(text: string): readonly string[] {
  const cached = TOKEN_CACHE.get(text);
  if (cached) return cached;
  const normalized = normalizeText(text);
  const tokens = normalized === '' ? [] : normalized.split(' ').map(stem);
  if (TOKEN_CACHE.size >= TOKEN_CACHE_LIMIT) TOKEN_CACHE.clear();
  TOKEN_CACHE.set(text, tokens);
  return tokens;
}

/**
 * Vrai si `term` apparaît comme suite de mots entiers dans `text`, sans tenir
 * compte des accents, de la casse ni du pluriel simple.
 * `containsTerm("tomates cerises", "tomate")` → vrai ; `containsTerm("pomme de terre", "pomme")` → vrai ;
 * `containsTerm("thon", "on")` → faux.
 */
export function containsTerm(text: string, term: string): boolean {
  const needle = tokenize(term);
  if (needle.length === 0) return false;
  const haystack = tokenize(text);
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, offset) => haystack[start + offset] === word)) return true;
  }
  return false;
}

/** Vrai si l'un des `terms` apparaît dans `text`. */
export function containsAnyTerm(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => containsTerm(text, term));
}
