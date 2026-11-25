import { describe, expect, it } from 'vitest';
import catalogue from './catalogue-movements.fixture.json';
import { FIGURE_MUSCLES } from './muscles';
import {
  ALIASES,
  MOVEMENTS,
  distinctMovementKeys,
  hasMovement,
  movementKeys,
  resolveMovement,
} from './library';
import { frameShapes, movementViewBox } from './model';
import { solvePose } from './rig';

/** Mouvements demandés au départ (noms du catalogue). */
const REQUESTED = [
  'squat',
  'squat-goblet',
  'fente-avant',
  'fente-arriere',
  'pont-fessier',
  'hip-thrust',
  'souleve-de-terre',
  'souleve-de-terre-roumain',
  'pompe',
  'pompe-genoux',
  'pompe-inclinee',
  'developpe-couche',
  'developpe-epaules',
  'elevation-laterale',
  'rowing-unilateral',
  'rowing-penche',
  'tirage-vertical',
  'traction',
  'curl',
  'extension-triceps-tete',
  'dips-chaise',
  'planche',
  'planche-laterale',
  'crunch',
  'mountain-climber',
  'jumping-jack',
  'burpee',
  'step-up',
  'mollets-debout',
  'superman',
  'bird-dog',
  'chaise-murale',
  'mobilite-hanches',
  'mobilite-epaules',
];

describe('bibliothèque de poses', () => {
  it('chaque clé de pose du catalogue d’exercices est résolue (dessin ou alias)', () => {
    const missing = catalogue.keys.filter((key) => !hasMovement(key));
    expect(missing).toEqual([]);
    for (const key of catalogue.keys) expect(resolveMovement(key)?.key, key).toBe(key);
  });

  it('chaque mouvement demandé a une pose de départ et une pose d’arrivée', () => {
    for (const key of REQUESTED) {
      const def = resolveMovement(key);
      expect(def, key).toBeDefined();
      expect(def?.timeline.keys.length, key).toBeGreaterThanOrEqual(2);
    }
  });

  it('les alias pointent vers un dessin existant et gardent leur propre nom', () => {
    for (const [key, alias] of Object.entries(ALIASES)) {
      expect(MOVEMENTS[alias.base], key).toBeDefined();
      expect(key in MOVEMENTS, key).toBe(false);
      expect(resolveMovement(key)?.label).toBe(alias.label);
    }
    expect(movementKeys().length).toBe(distinctMovementKeys().length + Object.keys(ALIASES).length);
  });

  it('les variantes restent exprimables : inclinaison du banc et côté de travail', () => {
    const flat = resolveMovement('developpe-couche');
    const incline = resolveMovement('developpe-couche', { incline: 30 });
    expect(flat?.timeline.keys[0]?.pose.angles.trunk).toBeCloseTo(-90, 6);
    expect(incline?.timeline.keys[0]?.pose.angles.trunk).toBeCloseTo(-60, 6);
    expect(resolveMovement('rowing-unilateral', { side: 'droite' })?.mirrored).toBe(true);
    expect(resolveMovement('rowing-unilateral')?.mirrored).toBeUndefined();
  });

  it('chaque mouvement est décrit, a une vue, des muscles connus et des poses posées sur leurs appuis', () => {
    for (const key of distinctMovementKeys()) {
      const def = resolveMovement(key);
      if (!def) throw new Error(key);
      expect(def.description.length, key).toBeGreaterThan(40);
      expect(def.muscles.length, key).toBeGreaterThan(0);
      for (const m of def.muscles) expect(FIGURE_MUSCLES, key).toContain(m);
      for (const { pose } of def.timeline.keys) {
        const sk = solvePose(pose, def.view);
        // Rien ne passe sous le sol (marge pour le décalage de perspective du côté éloigné).
        if (def.view !== 'dessus') {
          for (const [name, p] of Object.entries(sk.joints))
            expect(p.y, `${key} ${name}`).toBeGreaterThan(-1);
        }
      }
    }
  });

  it('chaque pose déclare ses appuis ou ses prises, et le rendu les dessine', () => {
    for (const key of distinctMovementKeys()) {
      const def = resolveMovement(key);
      if (!def) throw new Error(key);
      const box = movementViewBox(def, 'female');
      for (const { pose } of def.timeline.keys) {
        const contacts = pose.contacts ?? [];
        const grips = Object.values(pose.grip ?? {});
        const airborne = 'ground' in pose.anchor && (pose.anchor.lift ?? 0) > 0;
        if (!airborne) expect(contacts.length + grips.length, key).toBeGreaterThan(0);
        const shapes = frameShapes(def, pose, { body: 'female' }, box);
        const marks = shapes.filter((s) => s.tone === 'contact').length;
        const grippedHands = contacts.filter((c) => {
          const g = c.startsWith('hand') ? pose.grip?.[c.slice(-1) as 'L' | 'R'] : undefined;
          return g === 'pronation' || g === 'supination' || g === 'neutre';
        }).length;
        expect(marks, key).toBe(contacts.length - grippedHands);
      }
    }
  });

  it('le cadre englobe toutes les poses et garde la même échelle du départ à l’arrivée', () => {
    for (const key of ['squat', 'pompe', 'traction', 'developpe-couche']) {
      const def = resolveMovement(key);
      if (!def) throw new Error(key);
      const box = movementViewBox(def, 'male');
      expect(box.width / box.height).toBeGreaterThanOrEqual(0.94);
      expect(box.width / box.height).toBeLessThanOrEqual(1.91);
      for (const { pose } of def.timeline.keys) {
        const sk = solvePose(pose, def.view);
        for (const p of Object.values(sk.joints)) {
          expect(p.x).toBeGreaterThan(box.x);
          expect(p.x).toBeLessThan(box.x + box.width);
          expect(-p.y).toBeGreaterThan(box.y);
          expect(-p.y).toBeLessThan(box.y + box.height);
        }
      }
    }
  });
});
