/**
 * Valide les fichiers de contenu embarqués avec les schémas Zod.
 * Lancé par `npm run validate-data` et automatiquement avant `npm run build`.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { exerciseCatalogFileSchema } from '../src/infrastructure/data/exerciseSchemas';
import { quizFileSchema, recipesFileSchema } from '../src/infrastructure/data/schemas';

const DATA_DIR = new URL('../src/infrastructure/data/', import.meta.url);

const files: readonly { name: string; schema: z.ZodType }[] = [
  { name: 'recipes.json', schema: recipesFileSchema },
  { name: 'quiz.json', schema: quizFileSchema },
  { name: 'exercises.json', schema: exerciseCatalogFileSchema },
];

let failed = false;

for (const { name, schema } of files) {
  const path = fileURLToPath(new URL(name, DATA_DIR));
  const raw: unknown = JSON.parse(await readFile(path, 'utf8'));
  const result = schema.safeParse(raw);
  if (result.success) {
    const count = Array.isArray(raw)
      ? raw.length
      : ((raw as { exercises?: unknown[] }).exercises?.length ?? 0);
    console.log(`✔ ${name} : ${count} entrée(s) valide(s)`);
  } else {
    failed = true;
    console.error(`✘ ${name} : ${result.error.issues.length} erreur(s)`);
    for (const issue of result.error.issues) {
      console.error(`  - [${issue.path.join('.')}] ${issue.message}`);
    }
  }
}

if (failed) process.exit(1);
