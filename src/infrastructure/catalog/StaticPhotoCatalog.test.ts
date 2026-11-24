import { describe, expect, it, vi } from 'vitest';
import { StaticPhotoCatalog, loadEmbeddedPhotoCredits, toPlainText } from './StaticPhotoCatalog';
import type { PhotoCreditRecord } from './StaticPhotoCatalog';

const record = (overrides: Partial<PhotoCreditRecord> = {}): PhotoCreditRecord => ({
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

describe('StaticPhotoCatalog', () => {
  it('construit l’adresse depuis la base, avec ou sans barre finale', async () => {
    const load = () => Promise.resolve([record()]);
    const a = await new StaticPhotoCatalog('/nutry/', load).getAll();
    const b = await new StaticPhotoCatalog('/nutry', load).getAll();
    expect(a[0]?.url).toBe('/nutry/photos/chili.webp');
    expect(b[0]?.url).toBe('/nutry/photos/chili.webp');
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
