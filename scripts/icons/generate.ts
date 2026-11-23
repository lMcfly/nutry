/**
 * Génère les icônes de la PWA à partir d'une source unique : `public/favicon.svg`.
 *
 *   npm run icons
 *
 * Rendu par @resvg/resvg-js (binaire précompilé, aucune compilation native, aucune police :
 * le logo n'a pas de texte). Le résultat est déterministe : relancer le script sur la même
 * source redonne les mêmes fichiers, qui sont commités dans `public/`.
 *
 * - `icons/icon-192.png`, `icons/icon-512.png` : usage « any », coins arrondis du logo ;
 * - `icons/icon-maskable-512.png` : fond plein bord à bord ; l'assiette (rayon 156/512)
 *   reste dans la zone de sécurité des icônes adaptatives (cercle de rayon 40 %, 204,8/512) ;
 * - `icons/apple-touch-icon.png` (180) : fond plein, iOS arrondit lui-même ;
 * - `favicon.ico` : PNG 16, 32 et 48 encapsulés (format ICO à entrées PNG).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));
const SOURCE = `${PUBLIC_DIR}favicon.svg`;

/** Le fond porte `id="fond"` dans la source : on retire ses coins arrondis. */
export function fullBleed(svg: string): string {
  const result = svg.replace(/(<rect id="fond"[^>]*?)\s+rx="\d+(?:\.\d+)?"/, '$1');
  if (result === svg) throw new Error('Rectangle de fond `id="fond"` avec `rx` introuvable.');
  return result;
}

export function renderPng(svg: string, size: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

/** Fichier ICO dont chaque image est un PNG (pris en charge depuis Windows Vista). */
export function buildIco(images: readonly { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // réservé
  header.writeUInt16LE(1, 2); // type : icône
  header.writeUInt16LE(images.length, 4);

  const entries: Buffer[] = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // largeur (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // hauteur
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // réservé
    entry.writeUInt16LE(1, 4); // plans
    entry.writeUInt16LE(32, 6); // bits par pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

function main(): void {
  const source = readFileSync(SOURCE, 'utf8');
  const bleed = fullBleed(source);

  const outputs: [string, Buffer][] = [
    ['icons/icon-192.png', renderPng(source, 192)],
    ['icons/icon-512.png', renderPng(source, 512)],
    ['icons/icon-maskable-512.png', renderPng(bleed, 512)],
    ['icons/apple-touch-icon.png', renderPng(bleed, 180)],
    ['favicon.ico', buildIco([16, 32, 48].map((size) => ({ size, png: renderPng(source, size) })))],
  ];

  for (const [path, data] of outputs) {
    writeFileSync(`${PUBLIC_DIR}${path}`, data);
    console.log(`public/${path} (${data.length} octets)`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
