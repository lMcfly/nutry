import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ProteinType, RecipeTag } from '@domain/recipe';
import { PROTEIN_TYPES } from '@domain/recipe';
import { FIXTURE_RECIPES } from '@domain/testing/fixtures';
import { DishIllustration } from './DishIllustration';
import { DISH_FAMILIES, pickDishFamily } from './match';
import type { DishFamily } from './match';

const dish = (name: string, mainProtein: ProteinType, tags: RecipeTag[] = []) => ({
  name,
  mainProtein,
  tags,
});

/** Noms réels du catalogue → famille attendue. */
const CASES: readonly (readonly [string, ProteinType, RecipeTag[], DishFamily])[] = [
  ['Salade de lentilles et carottes, vinaigrette à la moutarde', 'legumineuses', [], 'salade'],
  ['Salade de pâtes, œufs durs, tomates cerises et concombre', 'oeufs', [], 'salade'],
  ['Taboulé libanais', 'legumineuses', [], 'salade'],
  ['Bowl de quinoa, patate douce rôtie et brocoli, sauce citron-tahini', 'aucune', [], 'bowl'],
  ['Poke bowl au tofu mariné, edamame et mangue', 'soja-tofu', [], 'bowl'],
  ['Velouté de potiron aux lentilles corail', 'legumineuses', ['restes'], 'soupe'],
  ['Spaghetti complets aux champignons, ail et noix', 'aucune', [], 'pates'],
  ['Boulettes de bœuf à la sauce tomate et spaghetti', 'boeuf', [], 'pates'],
  ['Pad thaï au tofu et aux cacahuètes', 'soja-tofu', [], 'pates'],
  ['Risotto aux champignons et fromage à pâte dure', 'fromage', [], 'riz'],
  ['Paella aux fruits de mer', 'fruits-de-mer', [], 'riz'],
  ['Curry de pois chiches, patate douce et épinards', 'legumineuses', [], 'curry'],
  ['Poulet au lait de coco, curcuma et petits pois, riz', 'volaille', [], 'curry'],
  ['Dahl de lentilles corail aux épinards et riz basmati', 'legumineuses', [], 'curry'],
  ['Pavé de saumon, haricots verts et riz au citron', 'poisson', [], 'poisson'],
  [
    'Moules marinières aux petits légumes et pommes de terre vapeur',
    'fruits-de-mer',
    [],
    'poisson',
  ],
  ['Escalopes de dinde, champignons à la crème et tagliatelles', 'volaille', [], 'pates'],
  [
    'Hauts de cuisse de poulet rôtis, pommes de terre et carottes',
    'volaille',
    ['four'],
    'volaille',
  ],
  ['Steak haché, haricots verts persillés et riz', 'boeuf', [], 'viande'],
  ['Côtelettes d’agneau, flageolets et haricots verts à l’ail', 'agneau', [], 'viande'],
  ['Omelette aux champignons et à la ciboulette, salade verte', 'oeufs', [], 'oeufs'],
  ['Frittata aux courgettes, feta et menthe', 'oeufs', [], 'oeufs'],
  ['Lentilles vertes aux lardons et carottes', 'porc', [], 'viande'],
  ['Couscous express aux pois chiches et légumes', 'legumineuses', [], 'legumineuses'],
  ['Tofu poêlé, brocoli et riz à la sauce soja', 'soja-tofu', [], 'tofu'],
  ['Wraps au tofu paprika, carottes et houmous', 'soja-tofu', [], 'tofu'],
  ['Gratin de colin aux épinards et pommes de terre', 'poisson', [], 'gratin'],
  ['Hachis parmentier aux lentilles', 'legumineuses', [], 'gratin'],
  ['Endives au jambon gratinées', 'porc', [], 'gratin'],
  ['Galette complète aux champignons', 'porc', [], 'tarte'],
  ['Spanakopita, feuilleté grec aux épinards et à la feta', 'fromage', [], 'tarte'],
  ['Porridge à la pomme et à la cannelle', 'aucune', ['petit-dejeuner'], 'petit-dejeuner'],
  ['Œufs brouillés, avocat et pain complet', 'oeufs', ['petit-dejeuner'], 'petit-dejeuner'],
];

describe('pickDishFamily', () => {
  it.each(CASES)('%s → %s', (name, protein, tags, expected) => {
    expect(pickDishFamily(dish(name, protein, tags))).toBe(expected);
  });

  it('le petit-déjeuner l’emporte sur le nom', () => {
    expect(pickDishFamily(dish('Salade de fruits', 'aucune', ['petit-dejeuner']))).toBe(
      'petit-dejeuner',
    );
  });

  it('« wrap » ou « wok » sans tofu : repli sur la protéine, pas sur l’illustration tofu', () => {
    expect(pickDishFamily(dish('Wraps au poulet, avocat et carottes râpées', 'volaille'))).toBe(
      'volaille',
    );
    expect(pickDishFamily(dish('Wok de poulet et légumes', 'volaille'))).toBe('volaille');
    expect(pickDishFamily(dish('Wraps au tofu paprika', 'soja-tofu'))).toBe('tofu');
    expect(pickDishFamily(dish('Riz cantonais au jambon', 'oeufs'))).toBe('riz');
  });

  it('sans mot-clé, repli sur la protéine principale (toujours une famille connue)', () => {
    for (const protein of PROTEIN_TYPES) {
      expect(DISH_FAMILIES).toContain(pickDishFamily(dish('Plat du jour', protein)));
    }
    expect(pickDishFamily(dish('Plat du jour', 'boeuf'))).toBe('viande');
    expect(pickDishFamily(dish('Plat du jour', 'volaille'))).toBe('volaille');
    expect(pickDishFamily(dish('Plat du jour', 'poisson'))).toBe('poisson');
    expect(pickDishFamily(dish('Plat du jour', 'legumineuses'))).toBe('legumineuses');
  });

  it('chaque recette de référence reçoit une famille valide', () => {
    for (const recipe of FIXTURE_RECIPES) {
      expect(DISH_FAMILIES).toContain(pickDishFamily(recipe));
    }
  });

  it('couvre les 15 familles du catalogue illustré', () => {
    expect(DISH_FAMILIES).toHaveLength(15);
    const used = new Set(CASES.map(([, , , family]) => family));
    expect([...used].sort()).toEqual([...DISH_FAMILIES].sort());
  });
});

describe('<DishIllustration />', () => {
  it.each(DISH_FAMILIES)('« %s » : SVG décoratif, sans image externe', (family) => {
    const { container } = render(<DishIllustration family={family} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('data-family', family);
    expect(container.querySelectorAll('circle, ellipse, path, rect').length).toBeGreaterThan(8);
    expect(container.querySelector('img, image, use, foreignObject')).toBeNull();
    expect(container.innerHTML).not.toMatch(/https?:|data:/);
  });

  it('choisit la famille d’après la recette', () => {
    const { container } = render(
      <DishIllustration recipe={dish('Poulet basquaise et riz', 'volaille')} />,
    );
    expect(container.querySelector('svg')).toHaveAttribute('data-family', 'volaille');
  });
});
