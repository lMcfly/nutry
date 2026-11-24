import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RecipePhoto } from '@application/ports';
import { PHOTO_CREDITS_TEXTS } from '@application/usecases';
import { FIXTURE_RECIPES } from '@domain/testing/fixtures';
import { TEST_PROFILE, renderApp, renderScreen } from '../testing/renderApp';
import { PhotoCreditsPage } from './PhotoCreditsPage';
import { PrivacyPage } from './PrivacyPage';

const [first, second] = FIXTURE_RECIPES;
if (!first || !second) throw new Error('fixture');

const photo = (recipeId: string, overrides: Partial<RecipePhoto> = {}): RecipePhoto => ({
  recipeId,
  url: `/nutry/photos/${recipeId}.webp`,
  title: 'Plat.jpg',
  author: 'Benreis',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Plat.jpg',
  modified: 'recadrée et compressée',
  approximate: false,
  ...overrides,
});

describe('<PhotoCreditsPage />', () => {
  it('liste plat, auteur, licence, source et modification, liens sûrs', async () => {
    renderScreen(<PhotoCreditsPage />, {
      photos: [photo(first.id), photo(second.id, { license: 'PD', approximate: true })],
    });
    expect(
      screen.getByRole('heading', { name: PHOTO_CREDITS_TEXTS.title, level: 1 }),
    ).toBeVisible();
    const list = await screen.findByRole('region', { name: 'Liste des crédits photos' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    const row = items.find((item) => within(item).queryByText(first.name)) as HTMLElement;
    expect(row).toHaveTextContent('Benreis');
    expect(row).toHaveTextContent('CC BY-SA 4.0');
    expect(row).toHaveTextContent(PHOTO_CREDITS_TEXTS.modified);
    expect(within(row).queryByText(PHOTO_CREDITS_TEXTS.illustrative)).toBeNull();
    const licence = within(row).getByRole('link', { name: /^Licence/ });
    expect(licence).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0/');
    const source = within(row).getByRole('link', { name: /Wikimedia Commons/ });
    expect(source).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Plat.jpg');
    for (const link of [licence, source]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }

    const other = items.find((item) => within(item).queryByText(second.name)) as HTMLElement;
    expect(other).toHaveTextContent('Domaine public');
    expect(within(other).getByText(PHOTO_CREDITS_TEXTS.illustrative)).toBeVisible();
  });

  it('sans photo : message simple', async () => {
    renderScreen(<PhotoCreditsPage />);
    expect(await screen.findByText(PHOTO_CREDITS_TEXTS.empty)).toBeVisible();
  });

  it('est atteignable depuis la page Confidentialité', () => {
    renderScreen(<PrivacyPage />);
    expect(screen.getByRole('link', { name: 'Crédits photos' })).toHaveAttribute(
      'href',
      '/credits-photos',
    );
  });

  it('la route existe dans l’app', async () => {
    renderApp({ profile: TEST_PROFILE, route: '/credits-photos', photos: [photo(first.id)] });
    expect(
      await screen.findByRole('heading', { name: PHOTO_CREDITS_TEXTS.title, level: 1 }),
    ).toBeVisible();
    expect(await screen.findByText(first.name)).toBeVisible();
  });
});

describe('photos dans l’interface', () => {
  it('la carte du repas affiche la photo (alt = nom du plat), puis l’illustration si elle échoue', async () => {
    renderApp({
      profile: TEST_PROFILE,
      route: '/semaine',
      photos: FIXTURE_RECIPES.map((r) => photo(r.id)),
    });
    const img = await waitFor(() => {
      const found = document.querySelector<HTMLImageElement>('img[src^="/nutry/photos/"]');
      if (!found) throw new Error('pas encore de photo');
      return found;
    });
    const recipe = FIXTURE_RECIPES.find((r) => r.name === img.alt);
    expect(recipe).toBeDefined();
    expect(img).toHaveAttribute('src', `/nutry/photos/${recipe?.id}.webp`);
    fireEvent.error(img);
    expect(screen.queryByRole('img', { name: recipe?.name ?? '' })).toBeNull();
  });
});
