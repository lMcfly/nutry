import { containsAnyTerm } from '../shared';
import { CHEESES } from './food-terms';
import type { Allergen } from './recipe.constants';

/**
 * Mots-clés d'ingrédients révélant un allergène (comparaison sans accents, casse ni
 * pluriel simple). `except` : expressions qui annulent la détection pour cet allergène
 * (« lait de coco » n'est pas du lait). Table volontairement conservatrice : elle sert à
 * repérer un allergène oublié, pas à le déduire automatiquement.
 *
 * Produits composés du commerce : on retient leur composition la plus courante en
 * France, même si certaines marques n'ont pas l'allergène (règles détaillées dans
 * data/ciqual/README.md, « Allergènes et régimes ») : moutarde de Dijon et mayonnaise →
 * sulfites (disulfite de potassium), ketchup → céleri, pâte de curry thaïe → crevettes et
 * poisson, pesto → lait et fruits à coque, chocolat → lait et soja, gnocchis → gluten et
 * œufs, grana padano → œufs (lysozyme).
 */
export interface AllergenKeywords {
  readonly terms: readonly string[];
  readonly except?: readonly string[];
}

export const ALLERGEN_KEYWORDS: Readonly<Record<Allergen, AllergenKeywords>> = {
  lait: {
    terms: [
      'lait',
      'beurre',
      'crème',
      'yaourt',
      'ghee',
      'lactosérum',
      'babeurre',
      'lactose',
      'skyr',
      'kéfir',
      'petit suisse',
      'faisselle',
      'béchamel',
      'brioche',
      'pesto',
      'chocolat',
      ...CHEESES,
    ],
    except: [
      'lait de coco',
      "lait d'amande",
      'lait de soja',
      "lait d'avoine",
      'lait de riz',
      'crème de coco',
      'crème de soja',
      "crème d'avoine",
      'beurre de cacahuète',
      "beurre d'amande",
      'beurre de cacao',
      'beurre de karité',
    ],
  },
  gluten: {
    terms: [
      'blé',
      'farine',
      'pâtes',
      'pain',
      'chapelure',
      'semoule',
      'boulgour',
      'couscous',
      'sauce soja',
      'pâte feuilletée',
      'pâte brisée',
      'pâte sablée',
      'pâte à pizza',
      'nouilles',
      'vermicelle',
      'orge',
      'seigle',
      'épeautre',
      'avoine',
      'granola',
      'biscuit',
      'brioche',
      'croûton',
      'tortilla',
      'wrap',
      'malt',
      'kamut',
      'spaghetti',
      'tagliatelle',
      'penne',
      'fusilli',
      'macaroni',
      'coquillette',
      'linguine',
      'lasagne',
      'ravioli',
      'gnocchi',
      'filo',
      'pita',
      'naan',
      'panko',
      'udon',
      'ramen',
      'seitan',
      'muesli',
      'bière',
      'miso',
      'hoisin',
      'teriyaki',
    ],
    except: [
      'blé noir',
      'farine de riz',
      'farine de maïs',
      'farine de sarrasin',
      'farine de pois chiche',
      'farine de châtaigne',
      'farine de coco',
      'farine de lupin',
      "farine d'amande",
      'pâte de curry',
      'pâte de piment',
      "pâte d'amande",
      'pâte de sésame',
      'pâtes de riz',
      'pâtes sans gluten',
      'pain sans gluten',
      'semoule de maïs',
      'semoule de riz',
      'nouilles de riz',
      'vermicelle de riz',
      'tortilla de maïs',
      'avoine sans gluten',
      'sans gluten',
      'spaghetti de riz',
    ],
  },
  oeufs: {
    terms: ['oeuf', 'mayonnaise', 'meringue', 'brioche', 'gnocchi', 'grana padano', 'surimi'],
  },
  soja: {
    terms: [
      'soja',
      'tofu',
      'tempeh',
      'edamame',
      'miso',
      'tamari',
      'hoisin',
      'teriyaki',
      'chocolat',
    ],
    except: ['germe de soja', 'pousse de soja'],
  },
  sesame: {
    terms: ['sésame', 'tahini', 'tahin', 'houmous', 'gomasio', 'zaatar', 'dukkah', 'furikake'],
  },
  'fruits-a-coque': {
    terms: [
      'amande',
      'noix',
      'noisette',
      'cajou',
      'pistache',
      'pécan',
      'macadamia',
      'praliné',
      "lait d'amande",
      'pesto',
      'nougat',
      'frangipane',
      'massepain',
      'granola',
      'muesli',
    ],
    except: ['noix de coco', 'noix de muscade', 'noix de saint jacques', 'noix de veau'],
  },
  arachides: { terms: ['arachide', 'cacahuète', 'satay', 'saté'] },
  moutarde: { terms: ['moutarde', 'mayonnaise', 'vinaigrette', 'curry en poudre'] },
  celeri: {
    terms: ['céleri', 'bouillon', 'ketchup', 'fond de veau', 'fond de volaille', 'fumet'],
  },
  sulfites: {
    terms: [
      'vin',
      'vinaigre de vin',
      'vinaigre balsamique',
      'abricot sec',
      'raisin sec',
      'figue sèche',
      'pruneau',
      'fruits secs',
      'cidre',
      'porto',
      'xérès',
      'madère',
      'marsala',
      'champagne',
      'moutarde',
      'mayonnaise',
      'vinaigrette',
    ],
    // Graines entières : pas de conservateur. Le vinaigre de cidre reste à vérifier.
    except: ['graines de moutarde', 'vinaigre de cidre'],
  },
  poissons: {
    terms: [
      'poisson',
      'saumon',
      'cabillaud',
      'thon',
      'sardine',
      'maquereau',
      'colin',
      'merlu',
      'truite',
      'dorade',
      'anchois',
      'hareng',
      'églefin',
      'nuoc mam',
      'worcestershire',
      'tapenade',
      'surimi',
      'bonite',
      'dashi',
      'pâte de curry',
    ],
  },
  crustaces: {
    terms: [
      'crevette',
      'gambas',
      'crabe',
      'homard',
      'langouste',
      'langoustine',
      'écrevisse',
      'pâte de curry',
      'surimi',
    ],
  },
  mollusques: {
    terms: [
      'moule',
      'calamar',
      'encornet',
      'poulpe',
      'seiche',
      'huître',
      'palourde',
      'saint jacques',
      'bulot',
      'escargot',
    ],
  },
  lupin: { terms: ['lupin'] },
};

/** Allergènes révélés par le nom d'un ingrédient. */
export function allergensInIngredient(name: string): Allergen[] {
  return (Object.keys(ALLERGEN_KEYWORDS) as Allergen[]).filter((allergen) => {
    const { terms, except = [] } = ALLERGEN_KEYWORDS[allergen];
    return containsAnyTerm(name, terms) && !containsAnyTerm(name, except);
  });
}
