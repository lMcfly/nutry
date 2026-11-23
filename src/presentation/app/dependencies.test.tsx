import { render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createInMemoryPorts } from '@application/testing';
import { createUseCases } from '@application/usecases';
import { DependenciesProvider, useDependencies } from './dependencies';

function Theme() {
  const { getSettings } = useDependencies();
  const [theme, setTheme] = useState('…');
  useEffect(() => {
    void getSettings().then((s) => {
      setTheme(s.theme);
    });
  }, [getSettings]);
  return <p>{theme}</p>;
}

describe('DependenciesProvider', () => {
  it('fournit les cas d’usage injectés', async () => {
    const useCases = createUseCases(createInMemoryPorts());
    render(
      <DependenciesProvider value={useCases}>
        <Theme />
      </DependenciesProvider>,
    );
    expect(await screen.findByText('system')).toBeInTheDocument();
  });

  it('signale clairement un provider manquant', () => {
    // React journalise l'erreur attendue : on la rend silencieuse.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Theme />)).toThrow(/DependenciesProvider/);
    consoleError.mockRestore();
  });
});
