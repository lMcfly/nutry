/// <reference types="node" />
/**
 * QA phase 4 — confidentialité : aucune API réseau dans le cœur ni dans les adaptateurs
 * (PROMPT §2 et §3.9 : « aucune donnée envoyée »). Analyse statique des sources.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FixedClock, createInMemoryPorts } from '@application/testing';
import { createUseCases } from '@application/usecases';
import { EXERCISE_FIXTURES } from '@domain/testing/exercises.fixtures';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';
import { defaultTrainingInput } from '@domain/training';
import { StaticExerciseCatalog } from './catalog/StaticExerciseCatalog';

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
 * Seules adresses admises : la recherche YouTube des fiches d'exercices (lien sortant, jamais une
 * requête ; ADR 0015), les liens d'attribution Unsplash (texte des crédits) et son CDN
 * d'images (ADR 0014, CSP `img-src`), et les pages de licence des exercices et de leurs
 * vidéos (ADR 0015 : MIT, Creative Commons, Mixkit, Coverr). Jamais de `fetch` : ce sont des
 * `<img>` et des `<a>`.
 */
const ALLOWED_URLS =
  /https:\/\/(?:(?:images\.)?unsplash\.com|creativecommons\.org\/|opensource\.org\/licenses\/MIT|www\.youtube\.com\/results\?|mixkit\.co\/license\/|coverr\.co\/license)[^\s'"`)]*/g;

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

/**
 * Sport (ADR 0015, phase 3) : le seul hôte sortant est `www.youtube.com`, en LIEN (recherche
 * sur le nom de l'exercice, ouverte dans un nouvel onglet) ; les médias sont servis par l'app,
 * et aucune donnée de séance ne sort ailleurs que dans un fichier que la personne enregistre.
 */
describe('QA confidentialité du Sport', () => {
  const catalog = new StaticExerciseCatalog('/');

  it('seuls liens sortants du catalogue : des recherches YouTube ; médias relatifs', async () => {
    const exercises = await catalog.getExercises();
    expect(exercises.length).toBeGreaterThan(100);
    for (const exercise of exercises) {
      const media = await catalog.getMedia(exercise.id);
      if (!media) throw new Error(`média attendu : ${exercise.id}`);
      for (const link of media.links) {
        const url = new URL(link.url);
        expect(url.origin, exercise.id).toBe('https://www.youtube.com');
        expect(url.pathname).toBe('/results');
        // Le nom de l'exercice seul : jamais une donnée de la personne.
        expect(url.searchParams.get('search_query') ?? '').toContain(exercise.name);
      }
      for (const file of [...media.images.map((i) => i.src), ...media.videos.map((v) => v.src)]) {
        expect(file.startsWith('/'), file).toBe(true);
      }
    }
  });

  it('un parcours de séance ne partage et n’enregistre rien sans action de la personne', async () => {
    const ports = createInMemoryPorts({
      recipes: FIXTURE_RECIPES,
      exercises: EXERCISE_FIXTURES,
      clock: new FixedClock('2026-11-25T10:00:00.000Z'),
    });
    const uc = createUseCases(ports);
    await uc.saveProfile(makeProfile({ healthCondition: true }));
    await uc.saveTrainingProfile(defaultTrainingInput());
    const week = await uc.getTrainingWeek();
    if (week.status !== 'ready') throw new Error('programme attendu');
    const session = week.plan.sessions.find((s) => s.main.length > 0);
    const slot = session?.main[0];
    if (!session || !slot) throw new Error('séance attendue');
    const ref = { weekStart: week.plan.weekStart, sessionId: session.id, slotId: slot.slotId };
    await uc.startSession(ref);
    await uc.reportPain(ref);
    await uc.markExerciseDone(ref);
    await uc.completeSession(ref);
    await uc.getTrainingHistory();
    await uc.getSportRewards();
    await uc.listExerciseCredits();
    expect(ports.sharer.shared).toEqual([]);
    expect(ports.fileSaver.files).toEqual([]);
  });

  it('les données du Sport exportées ne contiennent aucune adresse, et « Tout effacer » les retire', async () => {
    const ports = createInMemoryPorts({
      recipes: FIXTURE_RECIPES,
      exercises: EXERCISE_FIXTURES,
      clock: new FixedClock('2026-11-25T10:00:00.000Z'),
    });
    const uc = createUseCases(ports);
    await uc.saveProfile(makeProfile());
    await uc.saveTrainingProfile(defaultTrainingInput());
    const week = await uc.getTrainingWeek();
    if (week.status !== 'ready') throw new Error('programme attendu');
    const session = week.plan.sessions.find((s) => s.main.length > 0);
    const slot = session?.main[0];
    if (!session || !slot) throw new Error('séance attendue');
    const ref = { weekStart: week.plan.weekStart, sessionId: session.id, slotId: slot.slotId };
    await uc.startSession(ref);
    await uc.markExerciseDone(ref);
    await uc.completeSession(ref);
    await uc.exportData();
    const file = JSON.parse(ports.fileSaver.files[0]?.content ?? '') as Record<string, unknown>;
    const sport = JSON.stringify([
      file['training'],
      file['trainingPlans'],
      file['sessionLogs'],
      file['painReports'],
    ]);
    expect(sport.length).toBeGreaterThan(100);
    expect(sport).not.toMatch(/https?:\/\/|www\./);
    expect(await uc.wipeAllData()).toEqual({ status: 'wiped' });
    const after = await ports.userData.exportAll();
    expect(after.training).toBeUndefined();
    expect([after.trainingPlans, after.sessionLogs, after.painReports]).toEqual([[], [], []]);
  });
});
