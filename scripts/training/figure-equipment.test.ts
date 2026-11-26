/**
 * Sécurité du Sport : le mannequin montre exactement l'exercice. Pour chacun des exercices du
 * catalogue, le matériel dessiné (pièces de décor et charges de la pose résolue) est celui du
 * catalogue, plus les accessoires du foyer déclarés dans `exerciseFigure.ts`, ni plus ni moins.
 */
import { describe, expect, it } from 'vitest';
import exercisesJson from '../../src/infrastructure/data/exercises.json';
import type { EquipmentKind } from '../../src/presentation/features/training/figure/equipment';
import {
  CATALOGUE_DRAWING,
  EXERCISE_FIGURES,
  figureEquipmentOf,
  figureOf,
} from '../../src/presentation/features/training/figure/exerciseFigure';
import { resolveMovement } from '../../src/presentation/features/training/figure/library';
import type { Equipment } from '../../src/domain/training';

interface Entry {
  id: string;
  name: string;
  movement: string;
  equipment: Equipment[];
  instructions: string[];
}
const exercises = exercisesJson.exercises as Entry[];

/** Matériel réellement dessiné par la pose résolue pour cet exercice. */
export function drawnEquipment(entry: Entry): Set<EquipmentKind> {
  const spec = figureOf(entry);
  const def = resolveMovement(entry.movement, { ...spec.variant, equipment: spec.equipment });
  if (!def) throw new Error(`pose inconnue : ${entry.movement}`);
  const drawn = new Set<EquipmentKind>();
  for (const item of def.scene ?? []) drawn.add(item.equipment);
  for (const load of def.loads ?? []) drawn.add(load.kind);
  return drawn;
}

const sorted = (set: Iterable<string>): string[] => [...set].sort();

describe('mannequin : le matériel dessiné est celui de l’exercice', () => {
  it('couvre les 192 exercices du catalogue', () => {
    expect(exercises).toHaveLength(192);
  });

  it('chaque matériel du catalogue a son dessin', () => {
    const catalogue = new Set(exercises.flatMap((e) => e.equipment));
    for (const item of catalogue) expect(CATALOGUE_DRAWING[item], item).toBeDefined();
  });

  it.each(exercises.map((e) => [e.id, e] as const))('%s', (_id, entry) => {
    expect(sorted(drawnEquipment(entry))).toEqual(sorted(figureEquipmentOf(entry)));
  });

  it('les exceptions déclarées visent des exercices du catalogue', () => {
    const ids = new Set(exercises.map((e) => e.id));
    for (const id of Object.keys(EXERCISE_FIGURES)) expect(ids.has(id), id).toBe(true);
  });

  /** Mots des consignes qui annoncent un accessoire : il doit être dessiné. */
  const MENTIONS: readonly (readonly [RegExp, EquipmentKind])[] = [
    [/serviette/i, 'serviette'],
    [/sac à dos/i, 'sac-a-dos'],
    [/bouteille/i, 'bouteilles'],
    [/slider/i, 'sliders'],
    [/coussin ferme/i, 'coussin'],
    [/\bmur\b/i, 'mur'],
  ];
  /** Mentions qui ne demandent pas d'accessoire dessiné (appui facultatif, contenu d'un sac…). */
  const MENTION_ONLY: Readonly<Record<string, readonly EquipmentKind[]>> = {
    // Un mur ou une chaise pour se tenir : appui facultatif, l'exercice se fait sans.
    'equilibre-une-jambe': ['mur'],
    // Les bouteilles remplissent le sac : seul le sac se voit.
    'rowing-sac-a-dos': ['bouteilles'],
    'rowing-penche-sac-a-dos': ['bouteilles'],
    // Pieds au sol ou contre un mur : le mur est une option.
    'extension-lombaire-swiss-ball': ['mur'],
    // Les serviettes servent de sliders : dessinés comme tels.
    'curl-ischio-sliders': ['serviette'],
  };

  it('tout accessoire cité dans les consignes est dessiné', () => {
    const problems: string[] = [];
    for (const entry of exercises) {
      const text = `${entry.name} ${entry.instructions.join(' ')}`;
      const drawn = drawnEquipment(entry);
      for (const [pattern, kind] of MENTIONS) {
        if (!pattern.test(text) || drawn.has(kind)) continue;
        if (MENTION_ONLY[entry.id]?.includes(kind)) continue;
        problems.push(`${entry.id} : « ${pattern.source} » cité mais ${kind} non dessiné`);
      }
    }
    expect(problems).toEqual([]);
  });
});
