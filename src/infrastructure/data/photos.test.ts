/**
 * Photos de plats (public/photos) : chaque fichier correspond à une recette du catalogue,
 * chaque crédit est complet et sous licence libre (voir docs/PHOTOS.md).
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import creditsJson from './photoCredits.json';
import recipesJson from './recipes.json';

const PHOTOS_DIR = fileURLToPath(new URL('../../../public/photos/', import.meta.url));
const FREE_LICENSE = /^(CC0|PD|CC BY(-SA)? \d\.\d)$/;
const credits = creditsJson as readonly {
  recipeId: string;
  file: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  modified: string;
  matchQuality: string;
}[];
const recipeIds = new Set((recipesJson as readonly { id: string }[]).map((r) => r.id));

describe('photos de plats', () => {
  it('chaque photo est une recette du catalogue, une fois, et le fichier existe', () => {
    const seen = new Set<string>();
    for (const c of credits) {
      expect(recipeIds.has(c.recipeId), `recette inconnue : ${c.recipeId}`).toBe(true);
      expect(seen.has(c.recipeId), `doublon : ${c.recipeId}`).toBe(false);
      seen.add(c.recipeId);
      expect(c.file).toBe(`${c.recipeId}.webp`);
      expect(existsSync(`${PHOTOS_DIR}${c.file}`), `fichier absent : ${c.file}`).toBe(true);
    }
  });

  it('aucun fichier orphelin dans public/photos, et chacun reste léger', () => {
    const files = readdirSync(PHOTOS_DIR).filter((f) => f.endsWith('.webp'));
    const listed = new Set(credits.map((c) => c.file));
    for (const file of files) {
      expect(listed.has(file), `sans crédit : ${file}`).toBe(true);
      expect(statSync(`${PHOTOS_DIR}${file}`).size, file).toBeLessThan(80 * 1024);
    }
    expect(files).toHaveLength(credits.length);
  });

  it('chaque crédit a auteur, licence libre, source et modification, en texte brut', () => {
    for (const c of credits) {
      for (const field of ['author', 'license', 'licenseUrl', 'sourceUrl', 'modified'] as const) {
        expect(c[field].trim(), `${c.recipeId}.${field}`).not.toBe('');
        expect(c[field], `${c.recipeId}.${field}`).not.toMatch(/[<>]|&\w+;|\s{2}/);
      }
      expect(c.license, c.recipeId).toMatch(FREE_LICENSE);
      expect(c.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(c.licenseUrl).toMatch(/^https:\/\//);
      expect(['exact', 'approchant']).toContain(c.matchQuality);
    }
  });
});
