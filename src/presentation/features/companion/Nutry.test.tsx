import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ACCESSORY_IDS,
  COLOR_IDS,
  COMPANION_MOODS,
  DEFAULT_LOOK,
  EYE_IDS,
} from '@domain/companion';
import type { CompanionLook } from '@domain/companion';
import nutryCss from './Nutry.module.css?raw';
import { Nutry } from './Nutry';

const FULL_LOOK: CompanionLook = {
  color: 'abricot',
  eyes: 'rieurs',
  accessories: {
    tete: 'toque-de-chef',
    visage: 'lunettes-rondes',
    cou: 'echarpe',
    corps: 'tablier',
  },
};

describe('<Nutry />', () => {
  it('est une image décrite : apparence, accessoires et humeur', () => {
    render(<Nutry look={FULL_LOOK} mood="joyeux" />);
    const nutry = screen.getByRole('img');
    expect(nutry).toHaveAccessibleName(
      'Nutry, la petite boule, couleur abricot, yeux rieurs, avec toque de chef, lunettes rondes, écharpe, tablier, il est joyeux',
    );
  });

  it('sans accessoire, le dit', () => {
    render(<Nutry look={DEFAULT_LOOK} mood="content" />);
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Nutry, la petite boule, couleur menthe, yeux ronds, sans accessoire, il est content',
    );
  });

  it.each(COMPANION_MOODS)('humeur « %s » : se dessine et se décrit', (mood) => {
    const { container } = render(<Nutry look={DEFAULT_LOOK} mood={mood} />);
    expect(screen.getByRole('img')).toHaveAttribute('data-mood', mood);
    // Jamais « triste » : aucune humeur négative dans la description.
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toMatch(/triste|déçu|fâché/);
    // Sieste : yeux fermés et « z z » ; sinon des yeux ouverts, pas de « z ».
    const zs = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(zs).toEqual(mood === 'sieste' ? ['z', 'z'] : []);
  });

  it('dessine chaque teinte, chaque style d’yeux et chaque accessoire', () => {
    for (const color of COLOR_IDS) {
      const { container, unmount } = render(
        <Nutry look={{ ...DEFAULT_LOOK, color }} mood="joyeux" size="s" />,
      );
      expect(container.querySelector('svg')).toHaveAttribute('data-color', color);
      expect(container.querySelectorAll('path, circle, ellipse').length).toBeGreaterThan(5);
      unmount();
    }
    for (const eyes of EYE_IDS) {
      const { container, unmount } = render(<Nutry look={{ ...DEFAULT_LOOK, eyes }} />);
      expect(container.querySelector('svg')?.getAttribute('aria-label')).toContain('yeux');
      unmount();
    }
    const bare = render(<Nutry look={DEFAULT_LOOK} />);
    const bareShapes = bare.container.querySelectorAll('*').length;
    bare.unmount();
    for (const id of ACCESSORY_IDS) {
      const slot =
        id === 'lunettes-rondes'
          ? 'visage'
          : id === 'echarpe'
            ? 'cou'
            : id === 'tablier'
              ? 'corps'
              : 'tete';
      const { container, unmount } = render(
        <Nutry look={{ ...DEFAULT_LOOK, accessories: { [slot]: id } }} />,
      );
      expect(container.querySelectorAll('*').length, id).toBeGreaterThan(bareShapes);
      unmount();
    }
  });

  it('teintes spéciales : cosmos étoilé, dégradés aurore et arc-en-ciel', () => {
    const cosmos = render(<Nutry look={{ ...DEFAULT_LOOK, color: 'cosmos' }} />);
    expect(cosmos.container.querySelectorAll('[class*="stars"] circle').length).toBeGreaterThan(3);
    cosmos.unmount();
    const rainbow = render(<Nutry look={{ ...DEFAULT_LOOK, color: 'arc-en-ciel' }} />);
    expect(rainbow.container.querySelectorAll('linearGradient stop').length).toBeGreaterThanOrEqual(
      6,
    );
    rainbow.unmount();
    const dawn = render(<Nutry look={{ ...DEFAULT_LOOK, color: 'aurore' }} />);
    expect(dawn.container.querySelectorAll('linearGradient stop').length).toBeGreaterThanOrEqual(3);
    dawn.unmount();
    // Teinte ordinaire : dégradé radial.
    const plain = render(<Nutry look={DEFAULT_LOOK} />);
    expect(plain.container.querySelector('radialGradient')).not.toBeNull();
    expect(plain.container.querySelector('linearGradient')).toBeNull();
  });

  it('chaque instance a ses propres identifiants de dégradé', () => {
    const { container } = render(
      <>
        <Nutry look={DEFAULT_LOOK} />
        <Nutry look={DEFAULT_LOOK} />
      </>,
    );
    const ids = [...container.querySelectorAll('radialGradient')].map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tailles s, m et l', () => {
    const sizes = (['s', 'm', 'l'] as const).map((size) => {
      const { container, unmount } = render(<Nutry look={DEFAULT_LOOK} size={size} />);
      const className = container.querySelector('svg')?.getAttribute('class') ?? '';
      unmount();
      return className;
    });
    expect(new Set(sizes).size).toBe(3);
  });

  it('les animations (flottement, clignement, rebond) sont coupées si le mouvement est réduit', () => {
    expect(nutryCss).toMatch(/@keyframes float/);
    expect(nutryCss).toMatch(/@keyframes blink/);
    expect(nutryCss).toMatch(/@keyframes hop/);
    const reduced = nutryCss.slice(nutryCss.indexOf('prefers-reduced-motion'));
    for (const selector of ['.float', '.eyes', '.hop', '.zzz', '.stars']) {
      expect(reduced, selector).toContain(selector);
    }
    expect(reduced).toContain('animation: none');
  });
});
