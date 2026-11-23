import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

describe('<App />', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('redirige vers la semaine et affiche les 4 onglets', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Ma semaine' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(nav).toHaveTextContent(/Semaine.*Courses.*Profil.*Progrès/);
  });

  it('navigue entre les onglets', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('link', { name: 'Courses' }));
    expect(screen.getByRole('heading', { name: 'Mes courses' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Progrès' }));
    expect(screen.getByRole('heading', { name: 'Mes progrès' })).toBeInTheDocument();
  });
});
