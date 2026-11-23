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

describe('QA confidentialité', () => {
  it.each(['domain', 'application', 'infrastructure'])('%s : aucune API réseau ni URL', (layer) => {
    const files = sources(join(ROOT, layer));
    expect(files.length).toBeGreaterThan(5);
    const hits = files.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return NETWORK.filter((re) => re.test(text)).map(
        (re) => `${relative(ROOT, file)} : ${String(re)}`,
      );
    });
    expect(hits).toEqual([]);
  });
});
