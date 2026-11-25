/// <reference types="node" />
/**
 * QA phase 4 — confidentialité : aucune API réseau dans le cœur ni dans les adaptateurs
 * (PROMPT §2 et §3.9 : « aucune donnée envoyée »). Analyse statique des sources.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const NETWORK = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bsendBeacon\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /\bimportScripts\b/,
  /\bRTCPeerConnection\b/,
  /https?:\/\//,
];

/**
 * Seules adresses admises : les liens d'attribution Unsplash (texte des crédits) et son CDN
 * d'images (ADR 0014, CSP `img-src`), et les pages de licence des exercices et de leurs
 * vidéos (ADR 0015 : Creative Commons, Mixkit, Coverr). Jamais de `fetch` : ce sont des
 * `<img>` et des `<a>`.
 */
const ALLOWED_URLS =
  /https:\/\/(?:(?:images\.)?unsplash\.com|creativecommons\.org\/|mixkit\.co\/license\/|coverr\.co\/license)[^\s'"`)]*/g;

describe('QA confidentialité', () => {
  it.each(['domain', 'application', 'infrastructure'])('%s : aucune API réseau ni URL', (layer) => {
    const files = sources(join(ROOT, layer));
    expect(files.length).toBeGreaterThan(5);
    const hits = files.flatMap((file) => {
      const text = readFileSync(file, 'utf8').replace(ALLOWED_URLS, '');
      return NETWORK.filter((re) => re.test(text)).map(
        (re) => `${relative(ROOT, file)} : ${String(re)}`,
      );
    });
    expect(hits).toEqual([]);
  });
});
