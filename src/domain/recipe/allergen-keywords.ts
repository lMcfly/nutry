import { containsAnyTerm } from '../shared';
import { CHEESES } from './food-terms';
import type { Allergen } from './recipe.constants';

/**
 * Mots-clés d'ingrédients révélant un allergène (comparaison sans accents, casse ni
 * pluriel simple). `except` : expressions qui annulent la détection pour cet allergène
 * (« lait de coco » n'est pas du lait). Table volontairement conservatrice : elle sert à
 * repérer un allergène oublié, pas à le déduire automatiquement.
 */
export interface AllergenKeywords {
  readonly terms: readonly string[];
  readonly except?: readonly string[];
}

export const ALLERGEN_KEYWORDS: Readonly<Record<Allergen, AllergenKeywords>> = {
  lait: {
    terms: ['lait', 'beurre', 'crème', 'yaourt', 'ghee', 'lactosérum', 'babeurre', ...CHEESES],
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
    ],
  },
  oeufs: { terms: ['oeuf', 'mayonnaise', 'meringue'] },
  soja: {
    terms: ['soja', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari'],
    except: ['germe de soja', 'pousse de soja'],
  },
  sesame: { terms: ['sésame', 'tahini', 'tahin', 'houmous', 'gomasio'] },
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
    ],
    except: ['noix de coco', 'noix de muscade', 'noix de saint jacques', 'noix de veau'],
  },
  arachides: { terms: ['arachide', 'cacahuète'] },
  moutarde: { terms: ['moutarde'] },
  celeri: { terms: ['céleri', 'bouillon'] },
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
    ],
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
    ],
  },
  crustaces: {
    terms: ['crevette', 'gambas', 'crabe', 'homard', 'langouste', 'langoustine', 'écrevisse'],
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
