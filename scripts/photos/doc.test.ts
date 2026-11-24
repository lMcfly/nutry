import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOC_PATH, loadInputs, renderPhotosDoc } from './doc';

describe('docs/PHOTOS.md', () => {
  it('est à jour (relancer `npm run photos:doc` sinon)', () => {
    const { credits, names } = loadInputs();
    expect(readFileSync(DOC_PATH, 'utf8')).toBe(renderPhotosDoc(credits, names));
  });

  it('liste chaque photo avec auteur, licence et source', () => {
    const doc = renderPhotosDoc(
      [
        {
          provider: 'wikimedia',
          recipeId: 'a',
          file: 'a.webp',
          title: 'A | B.jpg',
          author: 'Ana',
          license: 'CC0',
          licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
          modified: 'recadrée et compressée',
          matchQuality: 'approchant',
        },
      ],
      new Map([['a', 'Plat A']]),
    );
    expect(doc).toContain(
      '| Plat A | Wikimedia Commons | `a.webp` | Ana | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | [A \\| B.jpg](https://commons.wikimedia.org/wiki/File:A.jpg) | illustration |',
    );
  });

  it('Unsplash : photo distante, attribution avec les deux liens utm', () => {
    const doc = renderPhotosDoc(
      [
        {
          provider: 'unsplash',
          recipeId: 'b',
          title: 'a bowl',
          author: 'Bob',
          authorUrl: 'https://unsplash.com/@bob?utm_source=nutry&utm_medium=referral',
          license: 'Unsplash',
          licenseUrl: 'https://unsplash.com/license',
          sourceUrl: 'https://unsplash.com/photos/x?utm_source=nutry&utm_medium=referral',
          modified: 'recadrée et compressée',
          matchQuality: 'exact',
        },
      ],
      new Map([['b', 'Plat B']]),
    );
    expect(doc).toContain(
      '| Plat B | Unsplash | distante | Photo de [Bob](https://unsplash.com/@bob?utm_source=nutry&utm_medium=referral) sur [Unsplash](https://unsplash.com/?utm_source=nutry&utm_medium=referral) |',
    );
  });
});
