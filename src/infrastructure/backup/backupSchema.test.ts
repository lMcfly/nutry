import { describe, expect, it } from 'vitest';
import type { EncryptedPayload } from '@application/ports';
import { createInMemoryPorts } from '@application/testing';
import { createUseCases } from '@application/usecases';
import { INITIAL_COMPANION_STATE } from '@domain/companion';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';
import { WebCryptoCipher } from '../crypto/WebCryptoCipher';
import {
  BACKUP_LIMITS,
  migrateBackup,
  parseBackupFile,
  parseEncryptedPayload,
} from './backupSchema';
import { ZodBackupValidator } from './ZodBackupValidator';
import { SNAPSHOT_SCHEMA_VERSION } from '@domain/userdata';

/** Une vraie sauvegarde, produite par les cas d'usage. */
async function realBackup(): Promise<Record<string, unknown>> {
  const ports = createInMemoryPorts({
    recipes: FIXTURE_RECIPES,
    questions: [
      {
        id: 'q1',
        question: 'Q ?',
        choices: ['a', 'b', 'c', 'd'],
        correctIndex: 0,
        explanation: 'E.',
        category: 'cuisine',
        difficulty: 'facile',
      },
    ],
  });
  const uc = createUseCases(ports);
  await uc.saveProfile(makeProfile({ waistCm: 70, healthCondition: false, likes: ['saumon'] }));
  const view = await uc.getCurrentPlan();
  if (view.status !== 'ready') throw new Error('menu attendu');
  const meal = view.plan.meals[0];
  if (!meal) throw new Error('repas attendu');
  await uc.rateMeal({
    weekStart: view.plan.weekStart,
    mealId: meal.id,
    verdict: 'down',
    reason: 'trop-long',
  });
  await uc.addShoppingItem({ label: 'Café', aisle: 'epicerie' });
  await uc.logProgress({ weightKg: 62, waistCm: 70 });
  const quiz = await uc.getQuiz();
  await uc.answerQuiz({ questionId: quiz?.questionId ?? '', answerIndex: 0 });
  await uc.setTheme('dark');
  await uc.exportData();
  return JSON.parse(ports.fileSaver.files[0]?.content ?? '') as Record<string, unknown>;
}

const errorsOf = (raw: unknown) => {
  const result = parseBackupFile(raw);
  return result.ok ? [] : result.errors;
};

describe('schéma de sauvegarde', () => {
  it('accepte une vraie sauvegarde et rend l’instantané', async () => {
    const backup = await realBackup();
    const result = parseBackupFile(backup);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { app, exportedAt, ...snapshot } = backup;
    expect(result.snapshot).toEqual(snapshot);
    expect(result.exportedAt).toBe(exportedAt);
    expect(result.snapshot.ratings).toHaveLength(1);
    expect(result.snapshot.shopping[0]?.state.manualItems).toHaveLength(1);
  });

  it('ignore les clés inconnues', async () => {
    const backup = await realBackup();
    const result = parseBackupFile({ ...backup, evil: 1, settings: { theme: 'dark', x: 2 } });
    expect(result.ok && result.snapshot).not.toHaveProperty('evil');
    expect(result.ok && result.snapshot.settings).toEqual({ theme: 'dark' });
  });

  it('rejette ce qui ne vient pas de Nutry', () => {
    for (const raw of [null, 42, 'texte', [], {}, { app: 'autre', schemaVersion: 1 }]) {
      expect(parseBackupFile(raw)).toMatchObject({ ok: false, reason: 'invalide' });
    }
    expect(parseBackupFile({ app: 'nutry' })).toMatchObject({ ok: false, reason: 'invalide' });
    expect(parseBackupFile({ app: 'nutry', schemaVersion: 0 })).toMatchObject({ ok: false });
  });

  it('signale une sauvegarde d’une version future', () => {
    expect(
      parseBackupFile({ app: 'nutry', schemaVersion: SNAPSHOT_SCHEMA_VERSION + 1 }),
    ).toMatchObject({
      ok: false,
      reason: 'version-future',
    });
  });

  it('rejette les valeurs hors vocabulaire, dates invalides, doublons et listes démesurées', async () => {
    const backup = (await realBackup()) as {
      profile: object;
      plans: { meals: unknown[]; weekStart: string }[];
      progress: object[];
      ratings: object[];
    };
    const plan = backup.plans[0];
    if (!plan) throw new Error('menu attendu');
    const invalid: [string, unknown][] = [
      ['profile.allergens', { ...backup, profile: { ...backup.profile, allergens: ['kiwi'] } }],
      ['profile.age', { ...backup, profile: { ...backup.profile, age: '35' } }],
      ['plans.0.weekStart', { ...backup, plans: [{ ...plan, weekStart: '2026-02-30' }] }],
      ['plans.1', { ...backup, plans: [plan, plan] }],
      [
        'plans.0.meals',
        {
          ...backup,
          plans: [{ ...plan, meals: Array(BACKUP_LIMITS.meals + 1).fill(plan.meals[0]) }],
        },
      ],
      ['progress.0.weightKg', { ...backup, progress: [{ date: '2026-11-23', weightKg: -3 }] }],
      ['ratings.0.ratedAt', { ...backup, ratings: [{ ...backup.ratings[0], ratedAt: 'hier' }] }],
      ['settings.theme', { ...backup, settings: { theme: 'rose' } }],
      ['exportedAt', { ...backup, exportedAt: undefined }],
    ];
    for (const [path, raw] of invalid) {
      expect(errorsOf(raw).join('\n'), path).toContain(path);
    }
  });

  it('limite le nombre d’erreurs rapportées', async () => {
    const backup = await realBackup();
    const raw = {
      ...backup,
      plans: 1,
      ratings: 2,
      progress: 3,
      quiz: 4,
      companion: 7,
      shopping: 5,
      settings: 6,
    };
    expect(errorsOf(raw)).toHaveLength(5);
  });
});

describe('compagnon dans la sauvegarde', () => {
  const companion = {
    look: { color: 'aurore', eyes: 'doux', accessories: { tete: 'toque-de-chef', cou: 'echarpe' } },
    lastActiveDay: '2026-11-20',
    streak: 2,
    best: 12,
    acknowledgedBest: 7,
  };

  it('l’exporte avec son avancement et le relit à l’identique', async () => {
    const backup = { ...(await realBackup()), companion };
    const result = parseBackupFile(backup);
    expect(result.ok && result.snapshot.companion).toEqual(companion);
    // Une vraie sauvegarde (quiz répondu) porte déjà un compagnon avec un jour actif.
    const real = parseBackupFile(await realBackup());
    expect(real.ok && real.snapshot.companion).toMatchObject({ streak: 1, best: 1 });
  });

  it('refuse un compagnon absent, un élément inconnu ou une série impossible', async () => {
    const backup = await realBackup();
    const bad = (patch: Record<string, unknown>) =>
      errorsOf({ ...backup, companion: { ...companion, ...patch } }).join('\n');
    expect(errorsOf({ ...backup, companion: undefined }).join('\n')).toContain('companion');
    expect(bad({ look: { ...companion.look, color: 'noir' } })).toContain('companion.look.color');
    expect(bad({ look: { ...companion.look, accessories: { tete: 'echarpe' } } })).toContain(
      'companion.look.accessories.tete',
    );
    expect(bad({ streak: 13 })).toContain('série supérieure au record');
    expect(bad({ acknowledgedBest: 13 })).toContain('record célébré');
    expect(bad({ best: -1 })).toContain('companion.best');
    expect(bad({ best: 1.5 })).toContain('companion.best');
    expect(bad({ best: 100_001, streak: 0 })).toContain('companion.best');
    expect(bad({ lastActiveDay: undefined })).toContain('jour actif incohérent');
    expect(bad({ best: 0, streak: 0, acknowledgedBest: 0 })).toContain('jour actif incohérent');
    expect(bad({ lastActiveDay: '2026-13-40' })).toContain('companion.lastActiveDay');
    expect(bad({ lastActiveDay: '2099-01-01' })).toContain('postérieure');
  });

  it('refuse une apparence non débloquée par le record', async () => {
    const backup = await realBackup();
    const locked = { ...companion, best: 4, streak: 2, acknowledgedBest: 0 };
    expect(errorsOf({ ...backup, companion: locked }).join('\n')).toContain(
      'companion.look: apparence non débloquée',
    );
  });
});

describe('migrations des exports', () => {
  it('v2 → v3 : un export sans compagnon reçoit l’état initial', async () => {
    const rest = await realBackup();
    delete rest['companion'];
    const v2 = { ...rest, schemaVersion: 2 };
    const result = parseBackupFile(v2);
    expect(result.ok && result.snapshot.schemaVersion).toBe(3);
    expect(result.ok && result.snapshot.companion).toEqual(INITIAL_COMPANION_STATE);
    // Une clé `companion` parasite dans un fichier v2 est écrasée, jamais reprise.
    const stray = parseBackupFile({ ...v2, companion: { best: 99 } });
    expect(stray.ok && stray.snapshot.companion).toEqual(INITIAL_COMPANION_STATE);
  });

  it('v1 → v3 : les deux migrations s’enchaînent', async () => {
    const rest = await realBackup();
    delete rest['companion'];
    const v1 = {
      ...rest,
      schemaVersion: 1,
      quiz: {
        seenIds: [],
        streak: 1,
        bestStreak: 2,
        daily: { date: '2026-11-23', questionId: 'q1' },
      },
    };
    const result = parseBackupFile(v1);
    expect(result.ok && result.snapshot.schemaVersion).toBe(3);
    expect(result.ok && result.snapshot.companion).toEqual(INITIAL_COMPANION_STATE);
    expect(result.ok && result.snapshot.quiz.current?.sessionId).toBe('jour-2026-11-23');
  });

  it('v1 → v2 : la question du jour devient la question de la dernière session', async () => {
    const v2 = await realBackup();
    const v1 = {
      ...v2,
      schemaVersion: 1,
      quiz: {
        seenIds: ['q1'],
        streak: 1,
        bestStreak: 2,
        daily: { date: '2026-11-23', questionId: 'q1' },
      },
    };
    const result = parseBackupFile(v1);
    expect(result.ok && result.snapshot.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(result.ok && result.snapshot.quiz).toEqual({
      seenIds: [],
      streak: 1,
      bestStreak: 2,
      current: { sessionId: 'jour-2026-11-23', questionId: 'q1' },
    });
    // Un `daily` illisible est ignoré ; un état v1 sans `daily` passe tel quel.
    const noDaily = parseBackupFile({ ...v1, quiz: { seenIds: [], streak: 0, bestStreak: 0 } });
    expect(noDaily.ok && noDaily.snapshot.quiz).toEqual({ seenIds: [], streak: 0, bestStreak: 0 });
    // Le format v2 n'accepte plus `daily` (clé inconnue ignorée, jamais recopiée).
    const stray = parseBackupFile({ ...v2, quiz: { ...v1.quiz } });
    expect(stray.ok && stray.snapshot.quiz).toEqual({ seenIds: ['q1'], streak: 1, bestStreak: 2 });
  });

  it('v2 : refuse une question courante mal formée', async () => {
    const v2 = await realBackup();
    const bad = {
      ...v2,
      quiz: { seenIds: [], streak: 0, bestStreak: 0, current: { questionId: 'q1' } },
    };
    expect(errorsOf(bad).join('\n')).toContain('quiz.current.sessionId');
  });

  it('applique les migrations successives jusqu’à la version courante', () => {
    const migrations = {
      1: (raw: Record<string, unknown>) => ({ ...raw, schemaVersion: 2, renamed: raw['old'] }),
      2: (raw: Record<string, unknown>) => ({ ...raw, schemaVersion: 3, added: true }),
    };
    expect(migrateBackup({ schemaVersion: 1, old: 'x' }, migrations, 3)).toEqual({
      ok: true,
      raw: { schemaVersion: 3, old: 'x', renamed: 'x', added: true },
    });
    expect(migrateBackup({ schemaVersion: 3 }, migrations, 3)).toMatchObject({ ok: true });
  });

  it('échoue proprement sans migration disponible', () => {
    expect(migrateBackup({ schemaVersion: 1 }, {}, 2)).toMatchObject({
      ok: false,
      reason: 'invalide',
    });
    expect(migrateBackup({ schemaVersion: 1.5 }, {}, 2)).toMatchObject({ ok: false });
  });
});

describe('sauvegarde chiffrée', () => {
  it('reconnaît un vrai payload Web Crypto, et rien d’autre', async () => {
    const cipher = new WebCryptoCipher();
    const payload = JSON.parse(
      JSON.stringify(await cipher.encrypt('{"a":1}', 'phrase longue')),
    ) as EncryptedPayload;
    const parsed = parseEncryptedPayload(payload);
    expect(parsed).toEqual(payload);
    await expect(cipher.decrypt(parsed ?? payload, 'phrase longue')).resolves.toBe('{"a":1}');

    expect(parseEncryptedPayload({ ...payload, v: 2 })).toBeUndefined();
    expect(parseEncryptedPayload({ ...payload, salt: 'x'.repeat(65) })).toBeUndefined();
    expect(parseEncryptedPayload({ app: 'nutry', schemaVersion: 1 })).toBeUndefined();
    expect(parseEncryptedPayload(null)).toBeUndefined();
  });

  it('le validateur charge le schéma à la demande', async () => {
    const validator = new ZodBackupValidator();
    const backup = await realBackup();
    await expect(validator.parseBackup(backup)).resolves.toMatchObject({ ok: true });
    await expect(validator.parseEncrypted(backup)).resolves.toBeUndefined();
  });
});
