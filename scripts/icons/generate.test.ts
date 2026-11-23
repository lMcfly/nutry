import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildIco, fullBleed, renderPng } from './generate';

const publicFile = (path: string): Buffer =>
  readFileSync(fileURLToPath(new URL(`../../public/${path}`, import.meta.url)));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Largeur et hauteur lues dans l'en-tête IHDR. */
function pngSize(png: Buffer): { width: number; height: number } {
  expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe('icônes de la PWA', () => {
  it.each([
    ['icons/icon-192.png', 192],
    ['icons/icon-512.png', 512],
    ['icons/icon-maskable-512.png', 512],
    ['icons/apple-touch-icon.png', 180],
  ])('%s est un PNG carré de %i px', (path, size) => {
    expect(pngSize(publicFile(path))).toEqual({ width: size, height: size });
  });

  it('favicon.ico contient des PNG 16, 32 et 48', () => {
    const ico = publicFile('favicon.ico');
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => {
      const entry = 6 + 16 * i;
      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      return pngSize(ico.subarray(offset, offset + length)).width;
    });
    expect(sizes).toEqual([16, 32, 48]);
  });

  it('la variante plein cadre retire seulement les coins arrondis du fond', () => {
    const source = publicFile('favicon.svg').toString('utf8');
    const bleed = fullBleed(source);
    expect(bleed).not.toMatch(/<rect id="fond"[^>]*rx=/);
    expect(bleed.length).toBeLessThan(source.length);
    expect(() => fullBleed('<svg></svg>')).toThrow(/fond/);
  });

  it('le rendu est déterministe', () => {
    const svg = publicFile('favicon.svg').toString('utf8');
    expect(renderPng(svg, 48).equals(renderPng(svg, 48))).toBe(true);
    expect(buildIco([{ size: 256, png: renderPng(svg, 256) }]).readUInt8(6)).toBe(0);
  });
});
