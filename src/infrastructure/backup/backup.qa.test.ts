/**
 * QA phase 4 — sauvegarde de bout en bout avec les VRAIS adaptateurs : Dexie
 * (fake-indexeddb), schéma Zod, Web Crypto, catalogue embarqué. Aller-retour, atomicité,
 * fichiers hostiles, fichiers chiffrés altérés, allergènes après import.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { EncryptedPayload } from '@application/ports';
import { createUseCases } from '@application/usecases';
import type { AppPorts, UseCases } from '@application/usecases';
import {
  FakePersistence,
  FixedClock,
  InMemoryQuizRepository,
  RecordingFileSaver,
  RecordingSharer,
  SeededRandom,
} from '@application/testing';
import type { QuizQuestion } from '@domain/quiz';
import { makeProfile } from '@domain/testing/fixtures';
import { ALLERGENS, isRecipeCompatible } from '@domain/recipe';
import type { Allergen, Recipe } from '@domain/recipe';
import { SNAPSHOT_SCHEMA_VERSION } from '@domain/userdata';
import type { UserDataSnapshot } from '@domain/userdata';
import { JsonRecipeRepository, loadEmbeddedRecipes } from '../catalog/JsonCatalog';
import {
  PBKDF2_MAX_ITERATIONS,
  WebCryptoCipher,
  fromBase64,
  toBase64,
} from '../crypto/WebCryptoCipher';
import type { NutryDatabase } from '../db/NutryDatabase';
import {
  DexiePlanRepository,
  DexieProfileRepository,
  DexieProgressRepository,
  DexieQuizStateRepository,
  DexieRatingRepository,
  DexieSettingsRepository,
  DexieShoppingRepository,
  DexieUserDataStore,
} from '../db/repositories';
import { createTestDatabase } from '../db/testing';
import { ZodBackupValidator } from './ZodBackupValidator';

const QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'q1',
    question: 'Capitale de la France ?',
    choices: ['Paris', 'Lyon', 'Nice', 'Lille'],
    correctIndex: 0,
    explanation: 'Paris.',
    category: 'geographie',
    difficulty: 'facile',
  },
  ...(['q2', 'q3'] as const).map((id): QuizQuestion => ({
    id,
    question: `Question ${id} ?`,
    choices: ['a', 'b', 'c', 'd'],
    correctIndex: 1,
    explanation: 'Parce que.',
    category: 'histoire',
    difficulty: 'facile',
  })),
];

const dbs: NutryDatabase[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
});

interface Env {
  readonly db: NutryDatabase;
  readonly ports: AppPorts & { clock: FixedClock; fileSaver: RecordingFileSaver };
  readonly uc: UseCases;
}

function realEnv(cipher = new WebCryptoCipher()): Env {
  const db = createTestDatabase();
  dbs.push(db);
  const ports = {
    clock: new FixedClock(),
    random: new SeededRandom(7),
    profiles: new DexieProfileRepository(db),
    plans: new DexiePlanRepository(db),
    ratings: new DexieRatingRepository(db),
    progress: new DexieProgressRepository(db),
    quizBank: new InMemoryQuizRepository(QUESTIONS),
    quizState: new DexieQuizStateRepository(db),
    shopping: new DexieShoppingRepository(db),
    settings: new DexieSettingsRepository(db),
    recipes: new JsonRecipeRepository(),
    sharer: new RecordingSharer(),
    userData: new DexieUserDataStore(db),
    cipher,
    backupValidator: new ZodBackupValidator(),
    persistence: new FakePersistence(),
    fileSaver: new RecordingFileSaver(),
  };
  return { db, ports, uc: createUseCases(ports) };
}

/** Remplit TOUTES les tables par les cas d'usage. */
async function populate({ uc, ports }: Env): Promise<void> {
  await uc.saveProfile(
    makeProfile({ likes: ['saumon'], dislikes: ['navet'], batchCooking: true, waistCm: 72 }),
  );
  await uc.requestPersistentStorage();
  await uc.setTheme('dark');
  const view = await uc.getCurrentPlan();
  if (view.status !== 'ready') throw new Error('menu attendu');
  const [first, second] = view.plan.meals;
  await uc.rateMeal({ weekStart: view.plan.weekStart, mealId: first?.id ?? '', verdict: 'up' });
  await uc.rateMeal({
    weekStart: view.plan.weekStart,
    mealId: second?.id ?? '',
    verdict: 'down',
    reason: 'trop-long',
  });
  const list = await uc.getShoppingList();
  if (list.status !== 'ready') throw new Error('liste attendue');
  await uc.toggleShoppingItem(list.list.sections[0]?.items[0]?.key ?? '');
  await uc.addShoppingItem({ label: 'Café', aisle: 'epicerie' });
  await uc.logProgress({ weightKg: 62, waistCm: 72 });
  const quiz = await uc.getQuiz();
  await uc.answerQuiz({ questionId: quiz?.questionId ?? '', answerIndex: 0 });
  // Semaine suivante : un deuxième menu, une deuxième mesure.
  ports.clock.set('2026-12-01T09:00:00.000Z');
  await uc.getCurrentPlan();
  await uc.logProgress({ waistCm: 71 });
  ports.clock.set('2026-12-02T09:00:00.000Z');
}

async function snapshotOf(env: Env): Promise<UserDataSnapshot> {
  return env.ports.userData.exportAll();
}

const lastFile = (env: Env) => {
  const file = env.ports.fileSaver.files.at(-1);
  if (!file) throw new Error('fichier attendu');
  return file;
};

describe('QA sauvegarde : aller-retour avec les vrais adaptateurs', () => {
  it('export clair → tout effacer → import : toutes les tables identiques', async () => {
    const env = realEnv();
    await populate(env);
    await expect(env.uc.exportData()).resolves.toMatchObject({
      status: 'exported',
      fileName: 'nutry-sauvegarde-2026-12-02.json',
      encrypted: false,
    });
    const before = await snapshotOf(env);
    expect(before.plans).toHaveLength(2);
    expect(before.ratings).toHaveLength(2);
    expect(before.progress).toHaveLength(2);
    expect(before.shopping[0]?.state.manualItems).toHaveLength(1);
    expect(before.quiz.seenIds).toHaveLength(1);
    expect(before.settings).toMatchObject({ theme: 'dark', persistenceGranted: true });

    await env.uc.wipeAllData();
    for (const table of env.db.userTables.filter((t) => t !== env.db.settings)) {
      await expect(table.count()).resolves.toBe(0);
    }
    await expect(env.ports.settings.get()).resolves.toEqual({
      theme: 'system',
      persistenceGranted: true,
    });

    const result = await env.uc.importData({ content: lastFile(env).content });
    expect(result).toEqual({
      status: 'imported',
      counts: { profile: true, plans: 2, ratings: 2, progress: 2 },
    });
    expect(await snapshotOf(env)).toEqual(before);
    // Le menu restauré est réutilisé tel quel (pas de régénération).
    const view = await env.uc.getCurrentPlan();
    expect(view.status === 'ready' && view.origin).toBe('stored');
  });

  it('export chiffré → import dans une autre base : identique (hors réglage d’appareil)', async () => {
    const env = realEnv();
    await populate(env);
    await env.uc.exportData({ passphrase: 'une phrase assez longue' });
    expect(lastFile(env)).toMatchObject({
      name: 'nutry-sauvegarde-2026-12-02.nutry',
      mimeType: 'application/octet-stream',
    });
    const before = await snapshotOf(env);
    const other = realEnv();
    await expect(
      other.uc.importData({
        content: lastFile(env).content,
        passphrase: 'une phrase assez longue',
      }),
    ).resolves.toMatchObject({ status: 'imported' });
    const after = await snapshotOf(other);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { persistenceGranted, ...settings } = before.settings;
    expect(after).toEqual({ ...before, settings });
  });
});

describe('QA sauvegarde : import d’un ancien fichier (v1, « question du jour »)', () => {
  /** Fichier v1 tel qu'exporté avant le quiz « à chaque ouverture ». */
  async function v1File(daily: Record<string, unknown>): Promise<string> {
    const env = realEnv();
    await populate(env);
    await env.uc.exportData();
    const current = JSON.parse(lastFile(env).content) as Record<string, unknown>;
    return JSON.stringify({
      ...current,
      schemaVersion: 1,
      quiz: { seenIds: ['q1', 'q2'], streak: 4, bestStreak: 6, daily },
    });
  }

  it('question du jour sans réponse : migrée, redevenue « non vue », série conservée', async () => {
    const target = realEnv();
    const content = await v1File({ date: '2026-12-01', questionId: 'q2' });
    await expect(target.uc.importData({ content })).resolves.toMatchObject({
      status: 'imported',
    });
    const { quiz } = await snapshotOf(target);
    expect(quiz).toEqual({
      seenIds: ['q1'],
      streak: 4,
      bestStreak: 6,
      current: { sessionId: 'jour-2026-12-01', questionId: 'q2' },
    });
    // La prochaine ouverture tire une question jamais répondue, autre que l'ancienne.
    const next = await target.uc.getQuiz();
    expect(next?.questionId).toBe('q3');
    expect(next?.streak).toBe(4);
  });

  it('question du jour répondue : la réponse est gardée ; une v1 invalide reste refusée', async () => {
    const target = realEnv();
    const content = await v1File({ date: '2026-12-01', questionId: 'q2', answerIndex: 1 });
    await expect(target.uc.importData({ content })).resolves.toMatchObject({
      status: 'imported',
    });
    expect((await snapshotOf(target)).quiz).toMatchObject({
      seenIds: ['q1', 'q2'],
      current: { sessionId: 'jour-2026-12-01', questionId: 'q2', answerIndex: 1 },
    });
    const invalid = await v1File({ date: '2026-12-01', questionId: 'q2', answerIndex: 9 });
    await expect(target.uc.importData({ content: invalid })).resolves.toMatchObject({
      status: 'invalid',
    });
  });
});

describe('QA sauvegarde : atomicité', () => {
  it('un enregistrement invalide au milieu de l’import : la base précédente est intacte', async () => {
    const env = realEnv();
    await populate(env);
    const before = await snapshotOf(env);
    const replacement = await snapshotOf(realEnv()); // vide
    const broken = {
      ...replacement,
      profile: makeProfile({ age: 70 }),
      plans: [...before.plans, { ...before.plans[0], weekStart: undefined }],
    } as unknown as UserDataSnapshot;
    await expect(env.ports.userData.importAll(broken)).rejects.toThrow();
    expect(await snapshotOf(env)).toEqual(before);
  });

  it('« Tout effacer » vide toutes les tables, sauf le réglage d’appareil persistenceGranted', async () => {
    const env = realEnv();
    await populate(env);
    await env.ports.userData.clearAll();
    for (const table of env.db.userTables) await expect(table.count()).resolves.toBe(0);

    await populate(env);
    await env.uc.wipeAllData();
    for (const table of env.db.userTables.filter((t) => t !== env.db.settings)) {
      await expect(table.count()).resolves.toBe(0);
    }
    await expect(env.uc.getSettings()).resolves.toEqual({
      theme: 'system',
      persistenceGranted: true,
    });
    await expect(env.uc.getProfile()).resolves.toBeUndefined();
    await expect(env.uc.getBackupReminder()).resolves.toEqual({ due: false });
  });

  it('écritures concurrentes sur Dexie : rien n’est perdu', async () => {
    const env = realEnv();
    await env.uc.saveProfile(makeProfile());
    await Promise.all([
      ...Array.from({ length: 8 }, (_, i) => env.uc.addShoppingItem({ label: `A${i}` })),
      env.uc.logProgress({ waistCm: 70 }),
      env.uc.setTheme('dark'),
      env.uc.getBackupReminder(),
      env.uc.exportData(),
    ]);
    const snap = await snapshotOf(env);
    expect(snap.shopping[0]?.state.manualItems).toHaveLength(8);
    expect(snap.progress).toHaveLength(1);
    expect(snap.settings).toMatchObject({
      theme: 'dark',
      lastBackupAt: '2026-11-23T10:00:00.000Z',
    });
  });
});

describe('QA sauvegarde : fichiers hostiles (import refusé, base intacte)', () => {
  async function backupObject(): Promise<{ env: Env; raw: Record<string, unknown> }> {
    const env = realEnv();
    await populate(env);
    await env.uc.exportData();
    return { env, raw: JSON.parse(lastFile(env).content) as Record<string, unknown> };
  }

  it('rejette chaque variante sans toucher à la base', async () => {
    const { env, raw } = await backupObject();
    const before = await snapshotOf(env);
    const profile = raw['profile'] as Record<string, unknown>;
    const plans = raw['plans'] as Record<string, unknown>[];
    const ratings = raw['ratings'] as Record<string, unknown>[];
    const deep = '['.repeat(100_000) + ']'.repeat(100_000);
    const variants: [string, string][] = [
      ['vide', ''],
      ['pas du JSON', 'nutry'],
      ['tableau', '[]'],
      ['profondeur excessive (racine)', deep],
      [
        'profondeur excessive (champ)',
        JSON.stringify({ ...raw, plans: 0 }).replace('"plans":0', `"plans":${deep}`),
      ],
      [
        'chaîne géante',
        JSON.stringify({ ...raw, profile: { ...profile, likes: ['x'.repeat(1_000_000)] } }),
      ],
      ['trop gros', JSON.stringify({ ...raw, pad: 'x'.repeat(5_000_000) })],
      ['version future', JSON.stringify({ ...raw, schemaVersion: SNAPSHOT_SCHEMA_VERSION + 1 })],
      ['version non entière', JSON.stringify({ ...raw, schemaVersion: 0.5 })],
      [
        'allergène inconnu',
        JSON.stringify({ ...raw, profile: { ...profile, allergens: ['kiwi'] } }),
      ],
      ['régime inconnu', JSON.stringify({ ...raw, profile: { ...profile, diets: ['crudivore'] } })],
      ['âge négatif', JSON.stringify({ ...raw, profile: { ...profile, age: -1 } })],
      ['foyer vide', JSON.stringify({ ...raw, profile: { ...profile, householdSize: 0 } })],
      [
        'nombre non fini',
        JSON.stringify({ ...raw, profile: { ...profile, weightKg: 'X' } }).replace('"X"', '1e400'),
      ],
      [
        '30 février (jour)',
        JSON.stringify({ ...raw, plans: [{ ...plans[0], weekStart: '2026-02-30' }] }),
      ],
      [
        '30 février (instant)',
        JSON.stringify({
          ...raw,
          ratings: [{ ...ratings[0], ratedAt: '2026-02-30T10:00:00.000Z' }],
        }),
      ],
      ['mois 13', JSON.stringify({ ...raw, exportedAt: '2026-13-01T00:00:00.000Z' })],
      ['avis en double', JSON.stringify({ ...raw, ratings: [ratings[0], ratings[0]] })],
      ['semaines en double', JSON.stringify({ ...raw, plans: [plans[0], plans[0]] })],
      ['autre app', JSON.stringify({ ...raw, app: 'autre' })],
    ];
    for (const [label, content] of variants) {
      const result = await env.uc.importData({ content });
      expect(result.status, label).not.toBe('imported');
      if (label === 'version future') expect(result.status).toBe('future-version');
      if (label === 'trop gros') expect(result.status).toBe('too-large');
    }
    expect(await snapshotOf(env)).toEqual(before);
  });

  it('__proto__, constructor, prototype : ignorés, aucune pollution', async () => {
    const { env, raw } = await backupObject();
    const json = JSON.stringify(raw)
      .replace(
        '{"app":',
        '{"__proto__":{"polluted":"racine"},"constructor":{"prototype":{"polluted":"ctor"}},"app":',
      )
      .replace('"profile":{', '"profile":{"__proto__":{"polluted":"profil","isAdmin":true},');
    expect(json).toContain('"__proto__":{"polluted":"profil"');
    await expect(env.uc.importData({ content: json })).resolves.toMatchObject({
      status: 'imported',
    });
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty('polluted');
    const profile = await env.ports.profiles.get();
    expect(Object.getPrototypeOf(profile)).toBe(Object.prototype);
    expect(Object.keys(profile ?? {})).not.toContain('__proto__');
    expect((profile as unknown as Record<string, unknown>)['isAdmin']).toBeUndefined();
  });
});

describe('QA sauvegarde chiffrée', () => {
  async function encrypted(): Promise<{ env: Env; payload: EncryptedPayload }> {
    const env = realEnv();
    await populate(env);
    await env.uc.exportData({ passphrase: 'correct horse battery' });
    return { env, payload: JSON.parse(lastFile(env).content) as EncryptedPayload };
  }

  const flip = (b64: string, index = 0): string => {
    const bytes = fromBase64(b64);
    bytes[index] = (bytes[index] ?? 0) ^ 0x01;
    return toBase64(bytes);
  };

  it('format, paramètres et aucune donnée en clair', async () => {
    const { env, payload } = await encrypted();
    expect(Object.keys(payload).sort()).toEqual(['alg', 'data', 'iter', 'iv', 'kdf', 'salt', 'v']);
    expect(payload).toMatchObject({ v: 1, alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iter: 600_000 });
    expect(fromBase64(payload.salt)).toHaveLength(16);
    expect(fromBase64(payload.iv)).toHaveLength(12);
    const content = lastFile(env).content;
    for (const secret of ['nutry', 'saumon', 'navet', 'Café', 'weightKg', 'correct horse']) {
      expect(content).not.toContain(secret);
    }
  });

  it('sel et IV neufs à chaque export (même contenu, même phrase)', async () => {
    const cipher = new WebCryptoCipher();
    const payloads = await Promise.all(
      Array.from({ length: 4 }, () => cipher.encrypt('{"même":"contenu"}', 'même phrase !')),
    );
    expect(new Set(payloads.map((p) => p.salt)).size).toBe(4);
    expect(new Set(payloads.map((p) => p.iv)).size).toBe(4);
    expect(new Set(payloads.map((p) => p.data)).size).toBe(4);
  });

  it('phrase fausse, données / IV / sel / tag altérés : refus clair, base intacte', async () => {
    const { payload } = await encrypted();
    const target = realEnv();
    await target.uc.saveProfile(makeProfile({ age: 50 }));
    const before = await snapshotOf(target);
    const data = fromBase64(payload.data);
    const variants: [string, EncryptedPayload, string][] = [
      ['phrase fausse', payload, 'correct horse batterY'],
      ['data', { ...payload, data: flip(payload.data, 5) }, 'correct horse battery'],
      ['tag', { ...payload, data: flip(payload.data, data.length - 1) }, 'correct horse battery'],
      [
        'tronqué',
        { ...payload, data: toBase64(data.subarray(0, data.length - 4)) },
        'correct horse battery',
      ],
      ['iv', { ...payload, iv: flip(payload.iv) }, 'correct horse battery'],
      ['iv court', { ...payload, iv: toBase64(new Uint8Array(8)) }, 'correct horse battery'],
      ['sel', { ...payload, salt: flip(payload.salt) }, 'correct horse battery'],
      ['base64 invalide', { ...payload, data: '!!!' }, 'correct horse battery'],
    ];
    for (const [label, p, phrase] of variants) {
      const result = await target.uc.importData({ content: JSON.stringify(p), passphrase: phrase });
      expect(result.status, label).toBe('wrong-passphrase');
    }
    await expect(target.uc.importData({ content: JSON.stringify(payload) })).resolves.toMatchObject(
      { status: 'passphrase-required' },
    );
    expect(await snapshotOf(target)).toEqual(before);
  });

  it('itérations hors bornes : refus immédiat (pas de PBKDF2 piégé)', async () => {
    const { payload } = await encrypted();
    const target = realEnv();
    for (const iter of [1, 309_999, PBKDF2_MAX_ITERATIONS + 1, 2 ** 31, 600_000.5]) {
      const started = performance.now();
      const result = await target.uc.importData({
        content: JSON.stringify({ ...payload, iter }),
        passphrase: 'correct horse battery',
      });
      expect(result.status, String(iter)).not.toBe('imported');
      expect(performance.now() - started, String(iter)).toBeLessThan(200);
    }
  });

  it('la phrase est normalisée (NFC) : é composé ou décomposé ouvre la même sauvegarde', async () => {
    const cipher = new WebCryptoCipher();
    const payload = await cipher.encrypt('ok', 'café-secret');
    await expect(cipher.decrypt(payload, 'café-secret')).resolves.toBe('ok');
  });
});

describe('QA allergènes avec le catalogue réel, menu stocké avant le changement', () => {
  it.each(ALLERGENS)(
    '%s : jamais servi après déclaration, ni après import',
    async (allergen: Allergen) => {
      const catalog: readonly Recipe[] = await loadEmbeddedRecipes();
      const env = realEnv();
      await env.uc.saveProfile(makeProfile({ breakfast: true, batchCooking: true }));
      await env.uc.getCurrentPlan();
      await env.uc.exportData();
      const oldFile = lastFile(env).content;

      const profile = makeProfile({ breakfast: true, batchCooking: true, allergens: [allergen] });
      await env.uc.saveProfile(profile);
      const check = async () => {
        const view = await env.uc.getCurrentPlan();
        if (view.status !== 'ready') throw new Error('menu attendu');
        for (const meal of view.plan.meals) {
          const recipe = catalog.find((r) => r.id === meal.recipeId);
          expect(recipe && isRecipeCompatible(recipe, profile), meal.id).toBe(true);
          expect(recipe?.allergens).not.toContain(allergen);
        }
      };
      await check();
      // Import d'un ancien fichier (menu d'avant l'allergie) puis profil courant ré-appliqué.
      await env.uc.importData({ content: oldFile });
      await env.uc.saveProfile(profile);
      await check();
    },
  );
});
