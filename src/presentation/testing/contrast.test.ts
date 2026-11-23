import { describe, expect, it } from 'vitest';
import tokensCss from '../theme/tokens.css?raw';
import { contrastRatio, parseCustomProperties, parseHex } from './contrast';

/** Contenu du premier bloc `{ … }` qui suit `selector`. */
function blockAfter(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`Sélecteur introuvable : ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

const light = parseCustomProperties(blockAfter(tokensCss, ':root {'));
const darkForced = parseCustomProperties(blockAfter(tokensCss, ":root[data-theme='dark'] {"));
const darkSystem = parseCustomProperties(
  blockAfter(tokensCss, ":root:not([data-theme='light']) {"),
);

const AA_TEXT = 4.5;
const AA_UI = 3;

/** [texte, fond, ratio minimal] : chaque paire réellement utilisée par les composants. */
const PAIRS: readonly (readonly [string, string, number])[] = [
  ['text', 'bg', AA_TEXT],
  ['text', 'surface', AA_TEXT],
  ['text', 'surface-alt', AA_TEXT],
  ['text-muted', 'bg', AA_TEXT],
  ['text-muted', 'surface', AA_TEXT],
  ['text-muted', 'surface-alt', AA_TEXT],
  ['primary', 'bg', AA_TEXT],
  ['primary', 'surface', AA_TEXT],
  ['on-primary', 'primary', AA_TEXT],
  ['on-primary', 'primary-hover', AA_TEXT],
  ['on-primary-soft', 'primary-soft', AA_TEXT],
  ['accent', 'surface', AA_TEXT],
  ['accent', 'bg', AA_TEXT],
  ['on-accent', 'accent', AA_TEXT],
  ['on-accent-soft', 'surface', AA_TEXT],
  ['primary', 'primary-soft', AA_TEXT],
  ['primary', 'accent-soft', AA_UI],
  ['on-primary-soft', 'surface', AA_TEXT],
  ['on-accent-soft', 'accent-soft', AA_TEXT],
  ['success', 'success-soft', AA_TEXT],
  ['warning', 'warning-soft', AA_TEXT],
  ['danger', 'surface', AA_TEXT],
  ['danger', 'danger-soft', AA_TEXT],
  ['on-danger', 'danger', AA_TEXT],
  // Composants d'interface et focus : 3:1 (WCAG 1.4.11).
  ['border-strong', 'surface', AA_UI],
  ['border-strong', 'bg', AA_UI],
  ['accent', 'surface-alt', AA_UI],
  ['focus', 'bg', AA_UI],
  ['focus', 'surface', AA_UI],
  ['primary', 'surface-alt', AA_UI],
  // Jauges colorées (une par catégorie) : 3:1 sur la carte et sur leur piste.
  ['gauge-veg', 'surface', AA_UI],
  ['gauge-veg', 'surface-alt', AA_UI],
  ['gauge-protein', 'surface', AA_UI],
  ['gauge-protein', 'surface-alt', AA_UI],
  ['gauge-starch', 'surface', AA_UI],
  ['gauge-starch', 'surface-alt', AA_UI],
  ['gauge-fish', 'surface', AA_UI],
  ['gauge-fish', 'surface-alt', AA_UI],
];

describe('contraste des jetons (WCAG AA)', () => {
  it('calcule les ratios de référence', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(parseHex('#abc')).toEqual([0xaa, 0xbb, 0xcc]);
    expect(() => parseHex('vert')).toThrow();
  });

  it('les deux blocs du thème sombre sont identiques', () => {
    expect(darkSystem).toEqual(darkForced);
  });

  for (const [name, tokens] of [
    ['clair', light],
    ['sombre', darkForced],
  ] as const) {
    describe(`thème ${name}`, () => {
      it.each(PAIRS)('%s sur %s ≥ %s:1', (fg, bg, min) => {
        const foreground = tokens[`color-${fg}`] ?? tokens[fg];
        const background = tokens[`color-${bg}`] ?? tokens[bg];
        expect(foreground, `--color-${fg}`).toBeDefined();
        expect(background, `--color-${bg}`).toBeDefined();
        expect(contrastRatio(foreground ?? '', background ?? '')).toBeGreaterThanOrEqual(min);
      });
    });
  }
});
