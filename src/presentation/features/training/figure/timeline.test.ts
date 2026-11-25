import { describe, expect, it } from 'vitest';
import { distinctMovementKeys, resolveMovement } from './library';
import { pose } from './library/pose';
import { DEFAULT_FRAME, solvePose } from './rig';
import { cycleDuration, easeInOut, interpolatePose, lerpAngle, sampleTimeline } from './timeline';
import type { Timeline } from './timeline';

const standing = pose({ anchor: { joint: 'ankleL', at: { x: 0, y: 6 } } });
const squat = pose({
  trunk: 36,
  hip: 118,
  knee: 116,
  anchor: { joint: 'ankleL', at: { x: 0, y: 6 } },
});

describe('interpolation', () => {
  it('easing doux : 0 et 1 aux bornes, symétrique, monotone', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
    let previous = 0;
    for (let t = 0.05; t <= 1; t += 0.05) {
      expect(easeInOut(t)).toBeGreaterThanOrEqual(previous);
      previous = easeInOut(t);
    }
  });

  it('les angles passent par le plus court chemin', () => {
    expect(lerpAngle(170, -170, 0.5)).toBeCloseTo(180, 6);
    expect(lerpAngle(0, 90, 0.5)).toBeCloseTo(45, 6);
  });

  it('aux bornes, la pose interpolée est la pose de départ ou d’arrivée', () => {
    expect(interpolatePose(standing, squat, 0, 'profil', DEFAULT_FRAME)).toBe(standing);
    expect(interpolatePose(standing, squat, 1, 'profil', DEFAULT_FRAME)).toBe(squat);
  });

  it('à mi-chemin, les angles sont à mi-chemin et le pied ancré ne bouge pas', () => {
    const mid = interpolatePose(standing, squat, 0.5, 'profil', DEFAULT_FRAME);
    expect(mid.angles.kneeL).toBeCloseTo(58, 6);
    expect(mid.angles.trunk).toBeCloseTo(18, 6);
    const sk = solvePose(mid, 'profil');
    expect(sk.joints.ankleL.x).toBeCloseTo(0, 6);
    expect(sk.joints.ankleL.y).toBeCloseTo(6, 6);
  });

  it('une main posée sur une cible commune reste posée pendant tout le mouvement', () => {
    const def = resolveMovement('pompe');
    if (!def) throw new Error('pompe');
    const [a, b] = def.timeline.keys.map((k) => k.pose);
    if (!a || !b) throw new Error('poses');
    const target = a.reach?.handL;
    for (const t of [0.2, 0.5, 0.8]) {
      const sk = solvePose(interpolatePose(a, b, t, 'profil', DEFAULT_FRAME), 'profil');
      expect(sk.joints.handL.x).toBeCloseTo(target?.x ?? NaN, 1);
      expect(sk.joints.handL.y).toBeCloseTo(target?.y ?? NaN, 1);
    }
  });
});

describe('lecture d’une répétition', () => {
  const timeline: Timeline = {
    keys: [
      { pose: standing, hold: 200 },
      { pose: squat, hold: 100 },
    ],
    loop: 'aller-retour',
    moveMs: 1000,
  };

  it('durée = pauses + transitions (aller puis retour)', () => {
    expect(cycleDuration(timeline)).toBe(200 + 1000 + 100 + 1000);
  });

  it('commence par la pose de départ, atteint l’arrivée, puis boucle', () => {
    expect(sampleTimeline(timeline, 0, 'profil', DEFAULT_FRAME)).toBe(standing);
    expect(sampleTimeline(timeline, 1250, 'profil', DEFAULT_FRAME)).toBe(squat);
    expect(sampleTimeline(timeline, 2300, 'profil', DEFAULT_FRAME)).toBe(standing);
    const mid = sampleTimeline(timeline, 700, 'profil', DEFAULT_FRAME);
    expect(mid.angles.kneeL).toBeGreaterThan(0);
    expect(mid.angles.kneeL).toBeLessThan(116);
  });

  it('tempo réaliste : une répétition dure environ 2 à 3,5 s (cardio et mobilité exceptés)', () => {
    const fast = new Set([
      'mountain-climber',
      'jumping-jack',
      'genoux-hauts',
      'talons-fesses',
      'marche-sur-place',
      'cercles-bras',
      'rotation-epaules',
      'swing-kettlebell',
      'step-jack',
      'cercles-hanches',
      'russian-twist',
      'marche-laterale',
      'marche-talon-pointe',
    ]);
    for (const key of distinctMovementKeys()) {
      const def = resolveMovement(key);
      if (!def) throw new Error(key);
      const ms = cycleDuration(def.timeline);
      if (fast.has(key)) {
        expect(ms, key).toBeGreaterThan(600);
        expect(ms, key).toBeLessThan(4000);
      } else {
        expect(ms, key).toBeGreaterThanOrEqual(1800);
        expect(ms, key).toBeLessThanOrEqual(5500);
      }
    }
  });
});
