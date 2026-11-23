import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IMPORT_MAX_BYTES, IMPORT_MESSAGES } from '@application/usecases';
import { DataSection, FORGOTTEN_PASSPHRASE_WARNING, WIPE_CONFIRMATION_WORD } from './DataSection';
import { renderScreen } from '../../testing/renderApp';

describe('Mes données', () => {
  it('export chiffré : demande une phrase d’au moins 8 caractères', async () => {
    const { user, ports } = renderScreen(<DataSection />);
    await user.click(screen.getByRole('switch', { name: 'Protéger par une phrase secrète' }));
    expect(screen.getByText(FORGOTTEN_PASSPHRASE_WARNING)).toBeVisible();

    await user.type(screen.getByLabelText('Phrase secrète'), 'court');
    await user.click(screen.getByRole('button', { name: /Exporter mes données/ }));
    expect(await screen.findByText(/au moins 8 caractères\./)).toBeVisible();
    expect(screen.getByLabelText('Phrase secrète')).toHaveAttribute('aria-invalid', 'true');
    expect(ports.fileSaver.files).toHaveLength(0);

    await user.type(screen.getByLabelText('Phrase secrète'), ' et assez long');
    await user.click(screen.getByRole('button', { name: /Exporter mes données/ }));
    await waitFor(() => {
      expect(ports.fileSaver.files).toHaveLength(1);
    });
    expect(ports.fileSaver.files[0]?.name).toMatch(/\.nutry$/);
  });

  it('export en clair', async () => {
    const { user, ports } = renderScreen(<DataSection />);
    await user.click(screen.getByRole('button', { name: /Exporter mes données/ }));
    await waitFor(() => {
      expect(ports.fileSaver.files[0]?.name).toMatch(/\.json$/);
    });
    expect(await screen.findByText(/Sauvegarde enregistrée/)).toBeInTheDocument();
  });

  it('import chiffré avec une mauvaise phrase : message clair, rien ne change', async () => {
    const source = renderScreen(<DataSection />);
    await source.useCases.exportData({ passphrase: 'la bonne phrase' });
    const content = source.ports.fileSaver.files[0]?.content ?? '';
    delete source.ports.state.profile;

    const { user, ports } = renderScreen(<DataSection />);
    const before = ports.state.profile;
    const input = screen.getAllByLabelText('Choisir une sauvegarde à importer').at(-1);
    if (!input) throw new Error('champ fichier introuvable');
    await user.upload(
      input,
      new File([content], 'sauvegarde.nutry', { type: 'application/octet-stream' }),
    );

    const confirm = await screen.findByRole('alertdialog', {
      name: 'Remplacer toutes tes données ?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Oui, remplacer' }));
    const protectedDialog = await screen.findByRole('alertdialog', { name: 'Sauvegarde protégée' });
    await user.type(
      within(protectedDialog).getByLabelText('Phrase secrète de la sauvegarde'),
      'mauvaise phrase',
    );
    await user.click(within(protectedDialog).getByRole('button', { name: 'Ouvrir la sauvegarde' }));
    expect(await within(protectedDialog).findByRole('alert')).toHaveTextContent(
      /phrase secrète est incorrecte/,
    );
    expect(ports.state.profile).toBe(before);
  });

  it('import d’un fichier invalide : message, données intactes', async () => {
    const { user, ports, statuses } = renderScreen(<DataSection />);
    const before = ports.state.profile;
    await user.upload(
      screen.getByLabelText('Choisir une sauvegarde à importer'),
      new File(['{"pas":"nutry"}'], 'x.json', { type: 'application/json' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Oui, remplacer' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/pas une sauvegarde Nutry/);
    expect(ports.state.profile).toBe(before);
    expect(statuses).toEqual([]);
  });

  it('fichier trop gros : refusé sur sa taille, sans être lu', async () => {
    const { user } = renderScreen(<DataSection />);
    const file = new File(['{}'], 'enorme.json', { type: 'application/json' });
    Object.defineProperty(file, 'size', { value: IMPORT_MAX_BYTES + 1 });
    const text = vi.spyOn(file, 'text');
    await user.upload(screen.getByLabelText('Choisir une sauvegarde à importer'), file);
    expect(await screen.findByText(IMPORT_MESSAGES['too-large'])).toBeInTheDocument();
    expect(text).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('import réussi : remplace tout et revient au menu', async () => {
    const source = renderScreen(<DataSection />);
    await source.useCases.exportData();
    const content = source.ports.fileSaver.files[0]?.content ?? '';

    const { user, ports, statuses } = renderScreen(<DataSection />, { profile: undefined });
    delete ports.state.profile;
    const input = screen.getAllByLabelText('Choisir une sauvegarde à importer').at(-1);
    if (!input) throw new Error('champ fichier introuvable');
    await user.upload(input, new File([content], 'sauvegarde.json', { type: 'application/json' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Oui, remplacer' }));
    await waitFor(() => {
      expect(statuses).toEqual(['ready']);
    });
    expect(ports.state.profile).toBeDefined();
  });

  it('tout effacer demande une confirmation forte', async () => {
    const { user, ports, statuses, useCases } = renderScreen(<DataSection />);
    await useCases.setTheme('dark');
    await user.click(screen.getByRole('button', { name: /Tout effacer/ }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Tout effacer ?' });
    const confirm = within(dialog).getByRole('button', { name: 'Effacer définitivement' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox'), WIPE_CONFIRMATION_WORD.toLowerCase());
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => {
      expect(statuses).toEqual(['none']);
    });
    expect(ports.state.profile).toBeUndefined();
    // Les valeurs gardées par Nutry dans le navigateur (thème…) sont effacées aussi.
    expect(ports.device.values.local.size).toBe(0);
  });
});
