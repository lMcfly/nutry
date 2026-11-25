import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { NumberDial } from './NumberDial';
import { TICK_PX, rulerIndexOfScroll, rulerScrollOfValue, rulerValueOfScroll } from './rulerMath';

describe('conversion défilement ↔ valeur', () => {
  it('une graduation par pas : 11 px = 1 unité, 0 px = le minimum', () => {
    expect(rulerValueOfScroll(0, 16, 80, 1)).toBe(16);
    expect(rulerValueOfScroll(TICK_PX * 14, 16, 80, 1)).toBe(30);
    expect(rulerScrollOfValue(30, 16, 80, 1)).toBe(TICK_PX * 14);
  });

  it('arrondit à la graduation la plus proche', () => {
    expect(rulerValueOfScroll(TICK_PX * 14 + 4, 16, 80, 1)).toBe(30);
    expect(rulerValueOfScroll(TICK_PX * 14 + 6, 16, 80, 1)).toBe(31);
  });

  it('demi-kilos : 0,5 par graduation, sans reste de calcul', () => {
    expect(rulerValueOfScroll(TICK_PX * 61, 40, 140, 0.5)).toBe(70.5);
    expect(rulerScrollOfValue(70.5, 40, 140, 0.5)).toBe(TICK_PX * 61);
  });

  it('reste en butée hors de la plage', () => {
    expect(rulerValueOfScroll(-300, 16, 80, 1)).toBe(16);
    expect(rulerValueOfScroll(99999, 16, 80, 1)).toBe(80);
    expect(rulerIndexOfScroll(99999, 16, 80, 1)).toBe(64);
    expect(rulerScrollOfValue(95, 16, 80, 1)).toBe(TICK_PX * 64);
    expect(rulerScrollOfValue(3, 16, 80, 1)).toBe(0);
  });
});

function Dial({ initial = '' }: { readonly initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberDial
      label="Âge"
      value={value}
      onChange={setValue}
      min={10}
      max={110}
      sliderMin={16}
      sliderMax={80}
      start={30}
      unit="ans"
    />
  );
}

describe('règle graduée', () => {
  it('expose un slider nommé, avec ses bornes et sa valeur', () => {
    render(<Dial initial="42" />);
    const ruler = screen.getByRole('slider', { name: 'Âge, règle' });
    expect(ruler).toHaveAttribute('aria-valuemin', '16');
    expect(ruler).toHaveAttribute('aria-valuemax', '80');
    expect(ruler).toHaveAttribute('aria-valuenow', '42');
    expect(ruler).toHaveAttribute('aria-valuetext', '42 ans');
  });

  it('le défilement donne la valeur sous le repère', () => {
    render(<Dial initial="30" />);
    const ruler = screen.getByRole('slider', { name: 'Âge, règle' });
    Object.defineProperty(ruler, 'scrollLeft', { value: TICK_PX * 20, configurable: true });
    fireEvent.scroll(ruler);
    expect(screen.getByLabelText('Âge', { selector: 'input' })).toHaveValue('36');
    expect(ruler).toHaveAttribute('aria-valuenow', '36');
  });

  it('clavier : flèches ±1, PageUp et PageDown ±10, Début et Fin', async () => {
    const user = userEvent.setup();
    render(<Dial initial="30" />);
    const ruler = screen.getByRole('slider', { name: 'Âge, règle' });
    const age = screen.getByLabelText('Âge', { selector: 'input' });
    ruler.focus();
    await user.keyboard('{ArrowRight}');
    expect(age).toHaveValue('31');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(age).toHaveValue('29');
    await user.keyboard('{PageUp}');
    expect(age).toHaveValue('39');
    await user.keyboard('{PageDown}{PageDown}');
    expect(age).toHaveValue('19');
    await user.keyboard('{Home}');
    expect(age).toHaveValue('16');
    await user.keyboard('{End}');
    expect(age).toHaveValue('80');
  });

  it('saisie hors plage mais valide acceptée : la règle reste en butée', async () => {
    const user = userEvent.setup();
    render(<Dial />);
    const age = screen.getByLabelText('Âge', { selector: 'input' });
    await user.type(age, '95');
    expect(age).toHaveValue('95');
    const ruler = screen.getByRole('slider', { name: 'Âge, règle' });
    expect(ruler).toHaveAttribute('aria-valuenow', '80');
    // Les boutons − / + continuent de suivre le domaine, pas la plage de la règle.
    await user.click(screen.getByRole('button', { name: 'Augmenter : Âge' }));
    expect(age).toHaveValue('96');
    await user.clear(age);
    await user.type(age, '12');
    expect(age).toHaveValue('12');
    expect(ruler).toHaveAttribute('aria-valuenow', '16');
    await user.click(screen.getByRole('button', { name: 'Diminuer : Âge' }));
    expect(age).toHaveValue('11');
  });

  it('un défilement qui reste en butée ne remplace pas une valeur hors plage', () => {
    render(<Dial initial="95" />);
    const ruler = screen.getByRole('slider', { name: 'Âge, règle' });
    Object.defineProperty(ruler, 'scrollLeft', { value: TICK_PX * 64, configurable: true });
    fireEvent.scroll(ruler);
    expect(screen.getByLabelText('Âge', { selector: 'input' })).toHaveValue('95');
  });
});
