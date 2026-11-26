import { describe, expect, it } from 'vitest';
import { CATALOGUE_DRAWING, figureEquipmentOf, figureOf } from './exerciseFigure';
import { resolveMovement } from './library';
import { EQUIPMENT_KINDS } from './equipment';

const towelRow = {
  id: 'tirage-serviette-vertical',
  movement: 'tirage-vertical-serviette',
  equipment: [],
} as const;

describe('du catalogue au mannequin', () => {
  it('le tirage vertical à la serviette ne montre ni poulie ni pile de plaques', () => {
    const spec = figureOf(towelRow);
    expect(spec.equipment).toEqual(['serviette', 'chaise']);
    const def = resolveMovement(spec.movement, { ...spec.variant, equipment: spec.equipment });
    const drawn = [
      ...(def?.scene ?? []).map((s) => s.equipment),
      ...(def?.loads ?? []).map((l) => l.kind),
    ];
    expect(drawn).toContain('serviette');
    expect(drawn).not.toContain('poulie');
    expect(drawn).not.toContain('machine');
  });

  it('un exercice sans matériel ne dessine aucun accessoire que la pose partagée aurait', () => {
    const def = resolveMovement('pompe', {
      equipment: figureEquipmentOf({ id: 'pompes', equipment: [] }),
    });
    expect(def?.scene).toEqual([]);
    expect(def?.loads).toEqual([]);
  });

  it('chaque matériel du catalogue a un dessin connu', () => {
    for (const kind of Object.values(CATALOGUE_DRAWING)) expect(EQUIPMENT_KINDS).toContain(kind);
  });
});
