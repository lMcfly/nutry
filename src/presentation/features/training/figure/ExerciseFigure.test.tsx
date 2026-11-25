import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import figureCss from './ExerciseFigure.module.css?raw';
import { ExerciseFigure } from './ExerciseFigure';

/** Simule `prefers-reduced-motion: reduce`. */
function reduceMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: reduce && query.includes('reduce'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<ExerciseFigure />', () => {
  it('est une image décrite : mouvement et muscles travaillés', () => {
    render(<ExerciseFigure movement="squat" mode="start" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAccessibleName(
      /^Squat : .*dos droit.*Muscles travaillés : quadriceps, fessiers\.$/,
    );
    // Les SVG sont décoratifs : le nom est porté par le conteneur.
    for (const svg of img.querySelectorAll('svg'))
      expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('animé : un bouton pause/lecture accessible au clavier', async () => {
    reduceMotion(false);
    const user = userEvent.setup();
    render(<ExerciseFigure movement="pompe" />);
    const toggle = screen.getByRole('button', { name: /Mettre en pause l’animation : Pompe/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('l’animation avance avec requestAnimationFrame', () => {
    reduceMotion(false);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const { container } = render(<ExerciseFigure movement="squat" />);
    const before = container.querySelector('svg')?.innerHTML;
    act(() => {
      frames.shift()?.(0);
    });
    act(() => {
      frames.shift()?.(1200);
    });
    expect(container.querySelector('svg')?.innerHTML).not.toBe(before);
  });

  it('mouvements réduits : départ et arrivée côte à côte, sans animation ni bouton', () => {
    reduceMotion(true);
    const { container } = render(<ExerciseFigure movement="curl" />);
    expect(container.querySelectorAll('svg[data-figure]')).toHaveLength(2);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('img')).toHaveAccessibleName(/Étapes du mouvement de gauche à droite/);
  });

  it('modes départ, arrivée et étapes', () => {
    const start = render(<ExerciseFigure movement="burpee" mode="start" />);
    expect(start.container.querySelectorAll('svg[data-figure]')).toHaveLength(1);
    start.unmount();
    const steps = render(<ExerciseFigure movement="burpee" mode="steps" />);
    expect(steps.container.querySelectorAll('svg[data-figure]')).toHaveLength(4);
    steps.unmount();
    const end = render(<ExerciseFigure movement="squat" mode="end" size={240} />);
    expect(end.container.querySelector('svg[data-figure]')).toHaveAttribute('width', '240');
  });

  it('compatible avec la CSP : aucun attribut style, couleurs par classes', () => {
    const { container } = render(<ExerciseFigure movement="developpe-couche" mode="steps" />);
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
    expect(container.querySelectorAll('path[class]').length).toBeGreaterThan(40);
    expect(container.querySelectorAll('[fill]:not(svg), [stroke]:not(svg)')).toHaveLength(0);
  });

  it('surligne les muscles demandés, ou aucun', () => {
    const highlighted = (muscles?: readonly ('biceps' | 'quadriceps')[]) => {
      const { container, unmount } = render(
        <ExerciseFigure movement="curl" mode="end" highlight={muscles} />,
      );
      const count = container.querySelectorAll('path').length;
      unmount();
      return count;
    };
    expect(highlighted([])).toBeLessThan(highlighted(['biceps']));
    expect(highlighted(['biceps', 'quadriceps'])).toBeGreaterThan(highlighted(['biceps']));
  });

  it('matériel : sans matériel, la scène et les charges disparaissent', () => {
    const count = (equipment?: readonly 'banc'[]) => {
      const { container, unmount } = render(
        <ExerciseFigure movement="developpe-couche" mode="start" equipment={equipment} />,
      );
      const n = container.querySelectorAll('path').length;
      unmount();
      return n;
    };
    expect(count([])).toBeLessThan(count(['banc']));
    expect(count(['banc'])).toBeLessThan(count());
  });

  it('les deux morphologies se dessinent', () => {
    for (const body of ['female', 'male'] as const) {
      const { container, unmount } = render(
        <ExerciseFigure movement="squat" mode="start" body={body} />,
      );
      expect(container.querySelectorAll('path').length).toBeGreaterThan(20);
      unmount();
    }
  });

  it('clé inconnue : rien n’est rendu', () => {
    const { container } = render(<ExerciseFigure movement="inconnu" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('la feuille de style n’anime rien elle-même (l’animation passe par requestAnimationFrame)', () => {
    expect(figureCss).not.toMatch(/@keyframes|animation:/);
  });
});
