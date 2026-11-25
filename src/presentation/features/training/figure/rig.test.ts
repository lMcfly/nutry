import { describe, expect, it } from 'vitest';
import { BODIES } from './body';
import { distinctMovementKeys, resolveMovement } from './library';
import { pose } from './library/pose';
import { DEFAULT_FRAME, FAR_OFFSET, LENGTHS, dist, mirrorPose, normalize, solvePose } from './rig';
import type { Pose, Skeleton, View } from './rig';
import { interpolatePose } from './timeline';

/** Longueur de chaque segment d'un squelette (sans raccourci de perspective). */
function lengths(sk: Skeleton) {
  const j = sk.joints;
  return (['L', 'R'] as const).flatMap(
    (s) =>
      [
        ['thigh', dist(j[`hip${s}`], j[`knee${s}`]), LENGTHS.thigh * sk.fold[`thigh${s}`]],
        ['shin', dist(j[`knee${s}`], j[`ankle${s}`]), LENGTHS.shin * sk.fold[`shin${s}`]],
        [
          'upperArm',
          dist(j[`shoulder${s}`], j[`elbow${s}`]),
          LENGTHS.upperArm * sk.fold[`upperArm${s}`],
        ],
        ['forearm', dist(j[`elbow${s}`], j[`wrist${s}`]), LENGTHS.forearm * sk.fold[`forearm${s}`]],
      ] as const,
  );
}

describe('cinématique directe', () => {
  it('debout : pieds au sol, tête en haut, proportions d’environ 7,5 têtes', () => {
    const sk = solvePose(pose({ anchor: { joint: 'ankleL', at: { x: 0, y: 6 } } }), 'profil');
    expect(sk.joints.heelL.y).toBeCloseTo(0, 5);
    expect(sk.joints.toeL.y).toBeCloseTo(0, 5);
    const height = sk.joints.head.y + LENGTHS.headRadius;
    expect(height / (2 * LENGTHS.headRadius)).toBeGreaterThan(7.3);
    expect(height / (2 * LENGTHS.headRadius)).toBeLessThan(8.3);
  });

  it('les longueurs de segments restent constantes dans toutes les poses et entre elles', () => {
    for (const key of distinctMovementKeys()) {
      const def = resolveMovement(key);
      if (!def) throw new Error(key);
      const keys = def.timeline.keys.map((k) => k.pose);
      const samples: Pose[] = [...keys];
      keys.forEach((a, i) => {
        const b = keys[(i + 1) % keys.length];
        if (b)
          for (const t of [0.25, 0.5, 0.75])
            samples.push(interpolatePose(a, b, t, def.view, DEFAULT_FRAME));
      });
      for (const p of samples) {
        const sk = solvePose(p, def.view);
        for (const [name, actual, expected] of lengths(sk)) {
          expect(actual, `${key} ${name}`).toBeCloseTo(expected, 6);
        }
        expect(dist(sk.joints.pelvis, sk.joints.waist), key).toBeCloseTo(
          LENGTHS.lumbar * sk.fold.torso,
          6,
        );
      }
    }
  });

  it('la cinématique inverse amène la main ou la cheville sur sa cible quand elle est atteignable', () => {
    for (const key of distinctMovementKeys()) {
      const def = resolveMovement(key);
      if (!def) throw new Error(key);
      for (const { pose: p } of def.timeline.keys) {
        const sk = solvePose(p, def.view);
        for (const [effector, target] of Object.entries(p.reach ?? {})) {
          const side = effector.slice(-1);
          const shifted =
            def.view === 'profil' && side === 'R'
              ? { x: target.x + FAR_OFFSET.x, y: target.y + FAR_OFFSET.y }
              : target;
          const joint = effector as 'handL' | 'handR' | 'ankleL' | 'ankleR';
          const root = joint.startsWith('hand')
            ? sk.joints[`shoulder${side as 'L' | 'R'}`]
            : sk.joints[`hip${side as 'L' | 'R'}`];
          const reach = joint.startsWith('hand')
            ? LENGTHS.upperArm * sk.fold[`upperArm${side as 'L' | 'R'}`] +
              (LENGTHS.forearm + LENGTHS.hand) * sk.fold[`forearm${side as 'L' | 'R'}`]
            : LENGTHS.thigh * sk.fold[`thigh${side as 'L' | 'R'}`] +
              LENGTHS.shin * sk.fold[`shin${side as 'L' | 'R'}`];
          if (dist(root, shifted) < reach - 0.5) {
            expect(dist(sk.joints[joint], shifted), `${key} ${effector}`).toBeLessThan(0.5);
          }
        }
      }
    }
  });

  it('l’ancre place l’articulation demandée au point demandé', () => {
    const p = pose({
      trunk: 30,
      hip: 90,
      knee: 90,
      anchor: { joint: 'kneeL', at: { x: 12, y: 5 } },
    });
    const sk = solvePose(p, 'profil');
    expect(sk.joints.kneeL.x).toBeCloseTo(12, 6);
    expect(sk.joints.kneeL.y).toBeCloseTo(5, 6);
  });

  it('pied « à plat » : talon et pointe au même niveau ; « sur la pointe » : pointe au sol', () => {
    const flat = solvePose(
      pose({ trunk: 30, hip: 110, knee: 110, anchor: { joint: 'ankleL', at: { x: 0, y: 6 } } }),
      'profil',
    );
    expect(flat.joints.heelL.y).toBeCloseTo(flat.joints.toeL.y, 5);
    const toes = solvePose(
      pose({
        anchor: { joint: 'pelvis', at: { x: 0, y: 92 } },
        reach: { ankleL: { x: 2, y: 13 } },
        feet: { L: 'toes' },
      }),
      'profil',
    );
    expect(toes.joints.toeL.y).toBeCloseTo(0, 3);
  });

  it('les deux morphologies partagent les mêmes longueurs : seules les largeurs changent', () => {
    const p = pose({ shoulder: 90, anchor: { ground: 0 } });
    for (const view of ['face', 'profil'] as View[]) {
      const female = solvePose(p, view, BODIES.female.frame);
      const male = solvePose(p, view, BODIES.male.frame);
      expect(dist(female.joints.shoulderL, female.joints.wristL)).toBeCloseTo(
        dist(male.joints.shoulderL, male.joints.wristL),
        6,
      );
    }
    expect(BODIES.female.frame.hipHalf).toBeGreaterThan(BODIES.male.frame.hipHalf);
    expect(BODIES.male.frame.shoulderHalf).toBeGreaterThan(BODIES.female.frame.shoulderHalf);
  });

  it('mirrorPose échange gauche et droite, deux fois de suite rend la pose d’origine', () => {
    const p = pose({
      hipL: 40,
      kneeL: 30,
      shoulderR: 70,
      anchor: { joint: 'ankleR', at: { x: 0, y: 6 } },
      grip: { L: 'paume' },
    });
    const m = mirrorPose(p);
    expect(m.angles.hipR).toBe(40);
    expect(m.angles.shoulderL).toBe(70);
    expect('joint' in m.anchor && m.anchor.joint).toBe('ankleL');
    expect(m.grip?.R).toBe('paume');
    expect(mirrorPose(m)).toEqual(p);
  });

  it('normalize ramène les angles dans ]-180, 180]', () => {
    expect(normalize(190)).toBe(-170);
    expect(normalize(-180)).toBe(180);
    expect(normalize(540)).toBe(180);
  });
});
