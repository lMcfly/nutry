import { describe, expect, it, vi } from 'vitest';
import {
  StaticPhotoCatalog,
  loadEmbeddedPhotoCredits,
  toPlainText,
  unsplashImageUrl,
} from './StaticPhotoCatalog';
import type {
  LocalPhotoCredit,
  PhotoCreditRecord,
  UnsplashPhotoCredit,
} from './StaticPhotoCatalog';

const record = (overrides: Partial<LocalPhotoCredit> = {}): LocalPhotoCredit => ({
  provider: 'wikimedia',
  recipeId: 'chili',
  file: 'chili.webp',
  title: 'Chili.jpg',
  author: 'Benreis',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Chili.jpg',
  modified: 'recadrée et compressée',
  matchQuality: 'exact',
  ...overrides,
});

describe('toPlainText', () => {
  it('retire balises, entités et espaces superflus', () => {
    expect(toPlainText('<a href="x">Jean  &amp; Marie</a>\n de&nbsp;Paris ')).toBe(
      'Jean & Marie de Paris',
    );
    expect(toPlainText('l&#39;auteur &lt;b&gt;')).toBe('l’auteur <b>');
  });
});

const unsplash = (overrides: Partial<UnsplashPhotoCredit> = {}): UnsplashPhotoCredit => ({
  provider: 'unsplash',
  recipeId: 'dahl',
  rawUrl: 'https://images.unsplash.com/photo-1?ixid=abc&ixlib=rb-4.1.0',
  focal: { x: 0.6, y: 0.55 },
  title: 'a bowl of dahl',
  author: 'Calum Lewis',
  authorUrl: 'https://unsplash.com/@calumlewis?utm_source=nutry&utm_medium=referral',
  license: 'Unsplash',
  licenseUrl: 'https://unsplash.com/license',
  sourceUrl: 'https://unsplash.com/photos/x?utm_source=nutry&utm_medium=referral',
  modified: 'recadrée et compressée',
  matchQuality: 'exact',
  ...overrides,
});

describe('unsplashImageUrl', () => {
  it('rogne en 4:3 autour du point de cadrage, avec ou sans zoom', () => {
    const raw = 'https://images.unsplash.com/photo-1?ixid=abc';
    expect(unsplashImageUrl(raw, { x: 0.6, y: 0.55 }, 400)).toBe(
      `${raw}&w=400&h=300&fit=crop&crop=focalpoint&fp-x=0.6&fp-y=0.55&q=75&fm=webp&auto=format`,
    );
    expect(unsplashImageUrl(raw, { x: 0.5, y: 0.5, z: 1.25 }, 1200)).toBe(
      `${raw}&w=1200&h=900&fit=crop&crop=focalpoint&fp-x=0.5&fp-y=0.5&fp-z=1.25&q=75&fm=webp&auto=format`,
    );
  });

  it('commence les paramètres par ? si l’adresse n’en a pas', () => {
    expect(unsplashImageUrl('https://images.unsplash.com/photo-1', { x: 0, y: 1 }, 800)).toMatch(
      /^https:\/\/images\.unsplash\.com\/photo-1\?w=800&h=600&/,
    );
  });
});

describe('StaticPhotoCatalog', () => {
  it('Unsplash : adresse distante, srcset 400/800/1200, auteur, aucune adresse locale', async () => {
    const [photo] = await new StaticPhotoCatalog('/nutry/', () =>
      Promise.resolve([unsplash()]),
    ).getAll();
    expect(photo).toMatchObject({
      provider: 'unsplash',
      authorUrl: 'https://unsplash.com/@calumlewis?utm_source=nutry&utm_medium=referral',
      license: 'Unsplash',
    });
    expect(photo?.src).toMatch(/^https:\/\/images\.unsplash\.com\/photo-1\?.*&w=800&h=600&/);
    const widths = photo?.srcSet?.split(', ').map((part) => part.split(' ')[1]);
    expect(widths).toEqual(['400w', '800w', '1200w']);
    expect(photo?.srcSet).toContain('&w=1200&h=900&');
    expect(photo?.srcSet).toContain('fp-x=0.6&fp-y=0.55&q=75&fm=webp');
  });

  it('local : pas de srcset', async () => {
    const [photo] = await new StaticPhotoCatalog('/', () => Promise.resolve([record()])).getAll();
    expect(photo?.srcSet).toBeUndefined();
    expect(photo?.provider).toBe('wikimedia');
  });

  it('construit l’adresse depuis la base, avec ou sans barre finale', async () => {
    const load = () => Promise.resolve([record()]);
    const a = await new StaticPhotoCatalog('/nutry/', load).getAll();
    const b = await new StaticPhotoCatalog('/nutry', load).getAll();
    expect(a[0]?.src).toBe('/nutry/photos/chili.webp');
    expect(b[0]?.src).toBe('/nutry/photos/chili.webp');
  });

  it('nettoie les crédits et signale les photos approchantes', async () => {
    const catalog = new StaticPhotoCatalog('/', () =>
      Promise.resolve([
        record({ author: '<b>Ana</b>   Lopez', matchQuality: 'approchant' }),
        record({ recipeId: 'autre' }),
      ]),
    );
    const photos = await catalog.getAll();
    expect(photos[0]).toMatchObject({ author: 'Ana Lopez', approximate: true });
    expect(photos[1]?.approximate).toBe(false);
  });

  it('charge une seule fois, et permet un nouvel essai après un échec', async () => {
    const load = vi
      .fn<() => Promise<readonly PhotoCreditRecord[]>>()
      .mockRejectedValueOnce(new Error('réseau'))
      .mockResolvedValue([record()]);
    const catalog = new StaticPhotoCatalog('/', load);
    await expect(catalog.getAll()).rejects.toThrow('réseau');
    await catalog.getAll();
    await catalog.getAll();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('charge les crédits embarqués', async () => {
    expect((await loadEmbeddedPhotoCredits()).length).toBeGreaterThan(0);
  });
});
