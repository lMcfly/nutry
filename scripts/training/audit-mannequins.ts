/**
 * Rapport d'audit mannequin ↔ catalogue (docs/audit-mannequins.md) :
 *
 *   npx tsx --tsconfig tsconfig.node.json scripts/training/audit-mannequins.ts
 *
 * Pour chacun des exercices : matériel du catalogue, matériel que dessinait la pose générique
 * avant la correction (« avant »), matériel dessiné maintenant (« après ») et la correction.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { Equipment } from '../../src/domain/training';
import {
  figureEquipmentOf,
  figureOf,
} from '../../src/presentation/features/training/figure/exerciseFigure';
import { resolveMovement } from '../../src/presentation/features/training/figure/library';

interface Entry {
  id: string;
  name: string;
  movement: string;
  equipment: Equipment[];
}
const exercises = (
  JSON.parse(readFileSync('src/infrastructure/data/exercises.json', 'utf8')) as {
    exercises: Entry[];
  }
).exercises;

/** Poses que l'exercice utilisait avant la correction (clé de pose partagée avec un autre exercice). */
const OLD_MOVEMENT: Record<string, string> = {
  'tirage-serviette-vertical': 'tirage-vertical (poulie et pile de plaques)',
  'tirage-vertical-elastique': 'tirage-vertical (poulie)',
  'extension-triceps-mur': 'pompe-mur (pompe, mains à hauteur d’épaules)',
  'extension-triceps-table': 'pompe-inclinee (pompe sur banc)',
  'curl-biceps-poids-du-corps': 'curl (debout, haltères)',
  'curl-incline-halteres': 'curl (debout)',
  'elevations-laterales-poulie': 'elevation-laterale (deux haltères)',
  'ecarte-au-sol-halteres': 'ecarte-couche (sur banc)',
  'squat-sumo': 'squat (pieds à largeur d’épaules)',
  'crunch-swiss-ball': 'crunch (sur tapis)',
  'planche-swiss-ball': 'planche (sur tapis)',
  'curl-ischio-sliders': 'curl-ischio-allonge (talons sur un ballon)',
};

const kinds = (def: ReturnType<typeof resolveMovement>): string[] =>
  [
    ...new Set([
      ...(def?.scene ?? []).map((s) => s.equipment),
      ...(def?.loads ?? []).map((l) => l.kind),
    ]),
  ].sort();
const fmt = (list: readonly string[]): string => (list.length > 0 ? list.join(' + ') : '—');

const rows: string[] = [];
let fixed = 0;
for (const e of exercises) {
  const spec = figureOf(e);
  const after = kinds(resolveMovement(e.movement, { ...spec.variant, equipment: spec.equipment }));
  const oldKey = OLD_MOVEMENT[e.id];
  // « Avant » : la pose générique, sans le matériel de l'exercice, sous sa clé d'origine.
  const generic = oldKey ? (oldKey.split(' ')[0] ?? e.movement) : e.movement;
  const before = kinds(resolveMovement(generic));
  const target = [...figureEquipmentOf(e)].sort();
  const wrong = before.join() !== target.join();
  const how = oldKey
    ? `pose dédiée (avant : ${oldKey})`
    : spec.variant.equipmentOverride
      ? `paramètre equipmentOverride (${JSON.stringify(spec.variant.equipmentOverride)})`
      : wrong
        ? 'matériel limité à celui de l’exercice'
        : 'conforme';
  if (how !== 'conforme') fixed += 1;
  rows.push(
    `| ${e.id} | ${e.movement} | ${fmt(e.equipment)} | ${fmt(before)} | ${fmt(after)} | ${how} |`,
  );
}

const text = `# Audit mannequin ↔ catalogue (ADR 0015, module Sport)

Généré par \`scripts/training/audit-mannequins.ts\`. Pour chacun des ${exercises.length} exercices :
matériel du catalogue, matériel que dessinait la pose générique **avant** la correction, matériel
dessiné **après**, et la correction. ${fixed} exercices ont été corrigés ; le test
\`scripts/training/figure-equipment.test.ts\` garantit que « après » est toujours le matériel de
l'exercice (catalogue + accessoires du foyer déclarés dans \`exerciseFigure.ts\`).

Cause : plusieurs exercices partageaient la clé de pose d'un autre exercice, avec un autre
matériel (le tirage vertical à la serviette montrait une poulie et une pile de plaques, le curl
à l'élastique des haltères, le curl au poids du corps un mannequin debout, etc.). Le composant
recevait la pose générique et son matériel, pas celui de l'exercice.

Corrections : le composant reçoit le matériel réel (\`figureOf(exercise)\`) ; une pose ne dessine
que ce matériel ; \`equipmentOverride\` (charge tenue, montage, prise) pour le même geste avec un
autre objet ; pose dédiée quand la position diffère vraiment (12 exercices).
Abduction et adduction à la machine : de face, cuisses raccourcies pour lire l'écart (8° à 50°),
boudins côté extérieur ou intérieur du genou, au premier plan.

Limites assumées, sans effet sur le matériel : la largeur de prise (serrée, large) ne se lit pas
de profil ; l'alternance gauche-droite (curl alterné) et les exercices à un bras
(développé épaules un bras) sont dessinés des deux côtés à la fois.

| Exercice | Pose | Matériel du catalogue | Dessiné avant | Dessiné après | Correction |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`;
writeFileSync('docs/audit-mannequins.md', text);
console.log(`docs/audit-mannequins.md : ${fixed} exercices corrigés sur ${exercises.length}`);
