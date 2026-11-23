import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChipGroup, RadioGroup } from './Choice';
import { Gauge } from './Gauge';
import { Sheet } from './Sheet';
import { Stepper } from './Stepper';
import { TOAST_ACTION_DURATION, TOAST_DURATION, ToastProvider, useToast } from './Toast';
import { Toggle } from './Toggle';

function SheetHarness({ variant }: { readonly variant?: 'sheet' | 'dialog' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Ouvrir
      </button>
      <Sheet
        open={open}
        variant={variant}
        title="Ma feuille"
        onClose={() => {
          setOpen(false);
        }}
      >
        <button type="button">Premier</button>
        <button type="button">Dernier</button>
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  it('piège le focus, se ferme avec Échap et rend le focus', async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    const opener = screen.getByRole('button', { name: 'Ouvrir' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Ma feuille' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Premier élément focalisable : le bouton ✕.
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Dernier' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Dernier' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('se ferme d’un glissement vers le bas, pas d’un petit geste', async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    const handle = screen.getByTestId('sheet-handle');
    fireEvent.pointerDown(handle, { clientY: 100 });
    fireEvent.pointerMove(handle, { clientY: 120 });
    fireEvent.pointerUp(handle, { clientY: 120 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerDown(handle, { clientY: 100 });
    fireEvent.pointerMove(handle, { clientY: 260 });
    fireEvent.pointerUp(handle, { clientY: 260 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('variante boîte : fermeture par le fond', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<SheetHarness variant="dialog" />);
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    expect(screen.queryByTestId('sheet-handle')).toBeNull();
    const backdrop = baseElement.querySelector('[data-sheet-host] > [aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    if (backdrop) await user.click(backdrop);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('choix', () => {
  it('ChipGroup : sélection multiple au clavier', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChipGroup
        legend="Allergies"
        options={[
          { value: 'gluten', label: 'Gluten' },
          { value: 'lait', label: 'Lait' },
        ]}
        selected={['lait']}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('group', { name: 'Allergies' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Lait' })).toBeChecked();
    screen.getByRole('checkbox', { name: 'Gluten' }).focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(['lait', 'gluten']);
    await user.click(screen.getByRole('checkbox', { name: 'Lait' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('RadioGroup : option désactivée non sélectionnable', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup
        legend="Objectif"
        layout="cards"
        options={[
          { value: 'a', label: 'Option A', hint: 'Explication' },
          { value: 'b', label: 'Option B', disabled: true },
        ]}
        value="a"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('radio', { name: /Option A/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Option B' })).toBeDisabled();
    await user.click(screen.getByText('Option B'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Toggle est un interrupteur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Toggle label="Petit-déjeuner" hint="Chaque matin" checked={false} onChange={onChange} />,
    );
    const toggle = screen.getByRole('switch', { name: 'Petit-déjeuner' });
    expect(toggle).toHaveAccessibleDescription('Chaque matin');
    await user.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Stepper respecte ses bornes', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [n, setN] = useState(1);
      return <Stepper label="Foyer" value={n} max={2} onChange={setN} format={(v) => `${v} p.`} />;
    }
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Diminuer' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Augmenter' }));
    expect(screen.getByText('2 p.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Augmenter' })).toBeDisabled();
  });
});

describe('Gauge', () => {
  it('expose une jauge lisible sans chiffre de calories', () => {
    render(<Gauge label="Poissons" count={3} target={2} />);
    const meter = screen.getByRole('meter', { name: 'Poissons' });
    expect(meter).toHaveAttribute('aria-valuetext', '3 sur 2, objectif atteint');
    expect(meter).toHaveAttribute('aria-valuenow', '2');
  });
});

describe('Toast', () => {
  it('annonce le message puis le retire', () => {
    vi.useFakeTimers();
    function Trigger() {
      const toast = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            toast.show('Liste copiée');
          }}
        >
          Copier
        </button>
      );
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copier' }));
    expect(screen.getByRole('status')).toHaveTextContent('Liste copiée');
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION + 10);
    });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    vi.useRealTimers();
  });

  it('propose une action, plus longtemps, et se ferme au clic', () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    function Trigger() {
      const toast = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            toast.show('Compris', 'info', { label: 'Remplacer', onClick });
          }}
        >
          Noter
        </button>
      );
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Noter' }));
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION + 10);
    });
    const action = screen.getByRole('button', { name: 'Remplacer' });
    fireEvent.click(action);
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Remplacer' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Noter' }));
    act(() => {
      vi.advanceTimersByTime(TOAST_ACTION_DURATION + 10);
    });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    vi.useRealTimers();
  });

  it('exige son provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Orphan() {
      useToast();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
