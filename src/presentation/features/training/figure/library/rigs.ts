/**
 * Montages génériques, appliqués après la fabrique du mouvement : barre posée sur le haut du dos,
 * charge tenue contre la poitrine, élastique sous les pieds. Les autres montages (table, chaise,
 * mur, poulie…) dépendent de la géométrie du mouvement et sont lus par sa fabrique.
 */
import { solvePose } from '../rig';
import type { Pose, View } from '../rig';
import { deriveContacts } from './build';
import { band } from './scene';
import { pt } from './pose';
import type { MovementDef, Rig, Variant } from './types';

export function rigsOf(variant: Variant): readonly Rig[] {
  const rig = variant.equipmentOverride?.rig;
  if (rig === undefined) return [];
  return typeof rig === 'string' ? [rig] : rig;
}

export const hasRig = (variant: Variant, rig: Rig): boolean => rigsOf(variant).includes(rig);

type Target = (sk: ReturnType<typeof solvePose>) => { x: number; y: number };

/** Amène les deux mains sur un point du tronc, pour chaque pose clé. */
function handsOnTorso(def: MovementDef, target: Target, grip: 'pronation' | 'neutre'): MovementDef {
  const view: View = def.view;
  const keys = def.timeline.keys.map((k) => {
    const sk = solvePose(k.pose, view);
    const at = target(sk);
    const next: Pose = {
      ...k.pose,
      reach: { ...k.pose.reach, handL: at, handR: at },
      grip: { L: grip, R: grip },
    };
    const bare = Object.fromEntries(
      Object.entries(next).filter(([name]) => name !== 'contacts'),
    ) as unknown as Pose;
    return { ...k, pose: { ...next, contacts: deriveContacts(bare, view) } };
  });
  return { ...def, timeline: { ...def.timeline, keys } };
}

const torsoPoint =
  (along: number, ahead: number): Target =>
  (sk) => {
    const t = (sk.thoracicTilt * Math.PI) / 180;
    const up = { x: Math.sin(t), y: Math.cos(t) };
    const front = { x: Math.cos(t), y: -Math.sin(t) };
    const n = sk.joints.neck;
    return pt(n.x + up.x * along + front.x * ahead, n.y + up.y * along + front.y * ahead);
  };

export function applyGenericRigs(def: MovementDef, variant: Variant): MovementDef {
  let out = def;
  const grip = variant.equipmentOverride?.grip;
  if (grip !== undefined) {
    const keys = out.timeline.keys.map((k) => ({
      ...k,
      pose: { ...k.pose, grip: { L: grip, R: grip } },
    }));
    out = { ...out, timeline: { ...out.timeline, keys } };
  }
  for (const rig of rigsOf(variant)) {
    if (rig === 'barre-dos') out = handsOnTorso(out, torsoPoint(-4, -9.5), 'pronation');
    else if (rig === 'poitrine') out = handsOnTorso(out, torsoPoint(-10, 10), 'neutre');
    else if (rig === 'elastique-pieds') {
      out = {
        ...out,
        scene: [
          ...(out.scene ?? []),
          ...band({ joint: 'handL' }, { joint: 'ankleL', dx: 5, dy: -3 }),
        ],
      };
    }
  }
  return out;
}
