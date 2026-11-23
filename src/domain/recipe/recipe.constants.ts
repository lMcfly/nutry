/**
 * Vocabulaires fermés du domaine recette.
 * Tableaux `as const` : source unique pour les types TS et les schémas Zod
 * (src/infrastructure/data/schemas.ts). Identifiants ASCII en kebab-case ;
 * les libellés français affichés relèvent de la présentation.
 */

export const LEVELS = ['simple', 'medium', 'experiment'] as const;
export type Level = (typeof LEVELS)[number];

export const DIETS = [
  'omnivore',
  'flexitarien',
  'vegetarien',
  'vegan',
  'sans-gluten',
  'sans-lactose',
] as const;
export type Diet = (typeof DIETS)[number];

/** Les 14 allergènes à déclaration obligatoire (règlement UE n° 1169/2011, annexe II). */
export const ALLERGENS = [
  'gluten',
  'crustaces',
  'oeufs',
  'poissons',
  'arachides',
  'soja',
  'lait',
  'fruits-a-coque',
  'celeri',
  'moutarde',
  'sesame',
  'sulfites',
  'lupin',
  'mollusques',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

/** Protéine principale d'un plat : sert à la règle de variété (pas deux fois d'affilée). */
export const PROTEIN_TYPES = [
  'boeuf',
  'porc',
  'volaille',
  'agneau',
  'poisson',
  'fruits-de-mer',
  'oeufs',
  'legumineuses',
  'soja-tofu',
  'fromage',
  'aucune',
] as const;
export type ProteinType = (typeof PROTEIN_TYPES)[number];

export const UNITS = [
  'g',
  'kg',
  'ml',
  'cl',
  'l',
  'piece',
  'cuillere-soupe',
  'cuillere-cafe',
  'pincee',
  'gousse',
  'botte',
  'tranche',
  'boite',
] as const;
export type Unit = (typeof UNITS)[number];

/** Rayons du magasin, dans l'ordre d'affichage de la liste de courses. */
export const AISLES = [
  'fruits-legumes',
  'boucherie-poissonnerie',
  'frais',
  'boulangerie',
  'epicerie',
  'surgeles',
] as const;
export type Aisle = (typeof AISLES)[number];

/**
 * Étiquettes de recette reconnues par le moteur de menu :
 * - `batch` : se prépare à l'avance pendant la session du dimanche ;
 * - `restes` : cuisiné au dîner, peut alimenter le déjeuner du lendemain ;
 * - `petit-dejeuner` : proposé uniquement au petit-déjeuner ;
 * - les autres sont informatives (affichage, filtres de l'UI).
 */
export const RECIPE_TAGS = [
  'batch',
  'restes',
  'monde',
  'sans-cuisson',
  'petit-dejeuner',
  'rapide',
  'four',
  'plat-unique',
] as const;
export type RecipeTag = (typeof RECIPE_TAGS)[number];
