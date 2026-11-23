import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DayStrip } from './DayStrip';
import { Gauge } from './Gauge';
import { RoundIconButton, RoundIconLink } from './RoundIconButton';
import { SegmentedTabs } from './SegmentedTabs';
import { Swipeable } from './Swipeable';
import { ListGroup, ListRow } from './ListRow';
import { PersonIcon } from './icons';
import { panelId, tabId } from './tabIds';

const TABS = [
  { id: 'a', label: 'Petit-déj' },
  { id: 'b', label: 'Déjeuner' },
  { id: 'c', label: 'Dîner' },
] as const;

describe('<SegmentedTabs />', () => {
  it('rôles tablist / tab, onglet actif sélectionné et relié à son panneau', () => {
    render(
      <SegmentedTabs label="Repas" tabs={TABS} value="b" onChange={() => undefined} idPrefix="t" />,
    );
    expect(screen.getByRole('tablist', { name: 'Repas' })).toBeVisible();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Déjeuner' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Déjeuner' })).toHaveAttribute(
      'aria-controls',
      panelId('t', 'b'),
    );
    expect(screen.getByRole('tab', { name: 'Déjeuner' })).toHaveAttribute('id', tabId('t', 'b'));
    // Un seul onglet dans l'ordre de tabulation.
    expect(tabs.filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('clic et flèches du clavier changent d’onglet (avec rebouclage)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedTabs label="Repas" tabs={TABS} value="c" onChange={onChange} idPrefix="t" />);
    await user.click(screen.getByRole('tab', { name: 'Petit-déj' }));
    expect(onChange).toHaveBeenLastCalledWith('a');
    screen.getByRole('tab', { name: 'Dîner' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('a');
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('c');
    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith('a');
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('c');
  });

  it('sans panneau précis, n’annonce pas aria-controls', () => {
    render(
      <SegmentedTabs
        label="Jours"
        tabs={TABS}
        value="a"
        onChange={() => undefined}
        idPrefix="j"
        controlsPanel={false}
        variant="chips"
      />,
    );
    expect(screen.getAllByRole('tab')[0]).not.toHaveAttribute('aria-controls');
  });
});

describe('<DayStrip />', () => {
  const days = [
    {
      id: '0',
      weekday: 'Lun',
      dayOfMonth: '23',
      ariaLabel: 'Lundi 23 novembre, aujourd’hui',
      isToday: true,
    },
    { id: '1', weekday: 'Mar', dayOfMonth: '24', ariaLabel: 'Mardi 24 novembre' },
  ];

  it('pastilles « Lun 23 » : jour actif sélectionné, nom complet pour les lecteurs d’écran', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DayStrip days={days} value="0" onChange={onChange} idPrefix="jour" />);
    const today = screen.getByRole('tab', { name: 'Lundi 23 novembre, aujourd’hui' });
    expect(today).toHaveAttribute('aria-selected', 'true');
    expect(today).toHaveTextContent('Lun');
    expect(today).toHaveTextContent('23');
    await user.click(screen.getByRole('tab', { name: 'Mardi 24 novembre' }));
    expect(onChange).toHaveBeenCalledWith('1');
  });
});

describe('<Swipeable />', () => {
  const swipe = (from: [number, number], to: [number, number]) => {
    fireEvent.pointerDown(screen.getByTestId('swipeable'), {
      clientX: from[0],
      clientY: from[1],
      pointerType: 'touch',
    });
    fireEvent.pointerUp(window, { clientX: to[0], clientY: to[1], pointerType: 'touch' });
  };

  it('à gauche : suivant ; à droite : précédent', () => {
    const onSwipe = vi.fn();
    render(
      <Swipeable onSwipe={onSwipe}>
        <p>contenu</p>
      </Swipeable>,
    );
    swipe([250, 100], [100, 110]);
    expect(onSwipe).toHaveBeenLastCalledWith('next');
    swipe([100, 100], [250, 90]);
    expect(onSwipe).toHaveBeenLastCalledWith('prev');
    expect(onSwipe).toHaveBeenCalledTimes(2);
  });

  it('ignore un trop petit geste ou un défilement surtout vertical', () => {
    const onSwipe = vi.fn();
    render(
      <Swipeable onSwipe={onSwipe}>
        <p>contenu</p>
      </Swipeable>,
    );
    swipe([200, 100], [170, 100]);
    swipe([200, 100], [120, 260]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('un clic simple sur un bouton à l’intérieur reste un clic', async () => {
    const onSwipe = vi.fn();
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Swipeable onSwipe={onSwipe}>
        <button type="button" onClick={onClick}>
          Voir
        </button>
      </Swipeable>,
    );
    await user.click(screen.getByRole('button', { name: 'Voir' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onSwipe).not.toHaveBeenCalled();
  });
});

describe('<Gauge /> colorée', () => {
  it('une couleur par catégorie, valeur et texte lisible', () => {
    render(
      <Gauge
        label="Légumes"
        tone="veg"
        count={50}
        target={100}
        valueLabel="50 %"
        valueText="50 pour cent de l’assiette"
        inline
      />,
    );
    const meter = screen.getByRole('meter', { name: 'Légumes' });
    expect(meter).toHaveAttribute('aria-valuenow', '50');
    expect(meter).toHaveAttribute('aria-valuetext', '50 pour cent de l’assiette');
    expect(screen.getByText('50 %')).toBeInTheDocument();
  });
});

describe('<RoundIconButton /> et <ListRow />', () => {
  it('bouton rond : nom accessible explicite, picto décoratif, légende masquée aux lecteurs', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <RoundIconButton
        icon="🌈"
        caption="Équilibre"
        label="Équilibre de la semaine"
        onClick={onClick}
      />,
    );
    const button = screen.getByRole('button', { name: 'Équilibre de la semaine' });
    expect(button).toHaveTextContent('Équilibre');
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('lien rond et lignes de réglages', () => {
    render(
      <MemoryRouter>
        <RoundIconLink to="/frigo" icon="🧊" label="Frigo vide" />
        <ListGroup>
          <ListRow icon={<PersonIcon />} title="Objectif" to="/x" />
          <ListRow icon={<PersonIcon />} title="Confidentialité" onClick={() => undefined} />
        </ListGroup>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Frigo vide' })).toHaveAttribute('href', '/frigo');
    expect(screen.getByRole('link', { name: 'Objectif' })).toHaveAttribute('href', '/x');
    expect(screen.getByRole('button', { name: 'Confidentialité' })).toBeVisible();
  });
});
