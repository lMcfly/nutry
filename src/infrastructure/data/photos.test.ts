/**
 * Photos de plats : chaque crédit correspond à une recette du catalogue, est complet et sous
 * licence libre (voir docs/PHOTOS.md). Photos locales (`public/photos`) : fichier présent, aucun
 * orphelin. Photos Unsplash : adresse distante sur images.unsplash.com, jamais de fichier local.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import creditsJson from './photoCredits.json';
import recipesJson from './recipes.json';

const PHOTOS_DIR = fileURLToPath(new URL('../../../public/photos/', import.meta.url));
const FREE_LICENSE = /^(CC0|PD|CC BY(-SA)? \d\.\d|Unsplash)$/;

interface Credit {
  provider: 'wikimedia' | 'foodiesfeed' | 'unsplash';
  recipeId: string;
  file?: string;
  rawUrl?: string;
  focal?: { x: number; y: number; z?: number };
  authorUrl?: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  modified: string;
  matchQuality: string;
}
const credits = creditsJson as readonly Credit[];
const local = credits.filter((c) => c.provider !== 'unsplash');
const remote = credits.filter((c) => c.provider === 'unsplash');
const recipeIds = new Set((recipesJson as readonly { id: string }[]).map((r) => r.id));

describe('photos de plats', () => {
  it('chaque photo est une recette du catalogue, une seule fois', () => {
    const seen = new Set<string>();
    for (const c of credits) {
      expect(recipeIds.has(c.recipeId), `recette inconnue : ${c.recipeId}`).toBe(true);
      expect(seen.has(c.recipeId), `doublon : ${c.recipeId}`).toBe(false);
      seen.add(c.recipeId);
      expect(['wikimedia', 'foodiesfeed', 'unsplash']).toContain(c.provider);
    }
  });

  it('photo locale : le fichier existe, sans adresse distante', () => {
    expect(local.length).toBeGreaterThan(0);
    for (const c of local) {
      expect(c.file).toBe(`${c.recipeId}.webp`);
      expect(existsSync(`${PHOTOS_DIR}${c.file}`), `fichier absent : ${c.file}`).toBe(true);
      expect(c.rawUrl, c.recipeId).toBeUndefined();
    }
  });

  it('photo Unsplash : adresse images.unsplash.com, cadrage valide, pas de fichier local', () => {
    expect(remote.length).toBeGreaterThan(0);
    for (const c of remote) {
      expect(c.rawUrl, c.recipeId).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
      expect(c.rawUrl, `${c.recipeId} : sans taille`).not.toMatch(/[?&](w|h|fit|crop)=/);
      expect(c.file, c.recipeId).toBeUndefined();
      expect(existsSync(`${PHOTOS_DIR}${c.recipeId}.webp`), `copie locale : ${c.recipeId}`).toBe(
        false,
      );
      const { x, y, z } = c.focal ?? { x: -1, y: -1 };
      expect(x, c.recipeId).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
      if (z !== undefined) expect(z).toBeGreaterThanOrEqual(1);
      // Attribution exigée : liens de l'auteur et de la photo, avec les paramètres utm.
      expect(c.authorUrl, c.recipeId).toMatch(
        /^https:\/\/unsplash\.com\/@[^/?]+\?utm_source=nutry&utm_medium=referral$/,
      );
      expect(c.sourceUrl, c.recipeId).toMatch(
        /^https:\/\/unsplash\.com\/photos\/.+\?utm_source=nutry&utm_medium=referral$/,
      );
      expect(c.license).toBe('Unsplash');
      expect(c.licenseUrl).toBe('https://unsplash.com/license');
    }
  });

  it('aucun fichier orphelin dans public/photos, et chacun reste léger', () => {
    const files = readdirSync(PHOTOS_DIR).filter((f) => f.endsWith('.webp'));
    const listed = new Set(local.map((c) => c.file));
    for (const file of files) {
      expect(listed.has(file), `sans crédit local : ${file}`).toBe(true);
      expect(statSync(`${PHOTOS_DIR}${file}`).size, file).toBeLessThan(80 * 1024 + 1024);
    }
    expect(files).toHaveLength(local.length);
    expect(readdirSync(PHOTOS_DIR).filter((f) => !f.endsWith('.webp'))).toEqual([]);
  });

  it('chaque crédit a auteur, licence libre, source et modification, en texte brut', () => {
    for (const c of credits) {
      for (const field of ['author', 'license', 'licenseUrl', 'sourceUrl', 'modified'] as const) {
        expect(c[field].trim(), `${c.recipeId}.${field}`).not.toBe('');
        expect(c[field], `${c.recipeId}.${field}`).not.toMatch(/[<>]|&\w+;|\s{2}/);
      }
      expect(c.license, c.recipeId).toMatch(FREE_LICENSE);
      expect(c.licenseUrl).toMatch(/^https:\/\//);
      expect(['exact', 'approchant']).toContain(c.matchQuality);
      if (c.provider === 'wikimedia') {
        expect(c.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      }
      if (c.provider === 'foodiesfeed') {
        expect(c.license).toBe('CC0');
        expect(c.sourceUrl).toMatch(/^https:\/\/www\.foodiesfeed\.com\//);
      }
    }
  });
});
