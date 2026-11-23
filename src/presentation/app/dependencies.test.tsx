import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DependenciesProvider, useDependencies, type AppDependencies } from './dependencies';

function Today() {
  const { clock } = useDependencies();
  return <p>{clock.now().getFullYear()}</p>;
}

describe('DependenciesProvider', () => {
  it('fournit les dépendances injectées', () => {
    const deps: AppDependencies = {
      clock: { now: () => new Date('2026-11-23T10:00:00Z'), today: () => '2026-11-23' },
      sharer: { share: () => Promise.resolve('copied') },
    };
    render(
      <DependenciesProvider value={deps}>
        <Today />
      </DependenciesProvider>,
    );
    expect(screen.getByText('2026')).toBeInTheDocument();
  });

  it('signale clairement un provider manquant', () => {
    // React journalise l'erreur attendue : on la rend silencieuse.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Today />)).toThrow(/DependenciesProvider/);
    consoleError.mockRestore();
  });
});
