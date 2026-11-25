/**
 * Sauvegarde et Sport (ADR 0015) : migration 3 → 4, aller-retour 4 → 4, schémas bornés et
 * cohérence des données importées (donnée NON FIABLE).
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-dynamic-delete, @typescript-eslint/no-unused-vars -- fichier de sauvegarde modifié à la main : valeurs volontairement non typées */
import { describe, expect, it } from 'vitest';
import { FixedClock, createInMemoryPorts } from '@application/testing';
import { createUseCases } from '@application/usecases';
import { EXERCISE_FIXTURES } from '@domain/testing/exercises.fixtures';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';
import { defaultTrainingInput } from '@domain/training';
import { SNAPSHOT_SCHEMA_VERSION } from '@domain/userdata';
import { BACKUP_LIMITS, SNAPSHOT_MIGRATIONS, parseBackupFile } from './backupSchema';
import { ZodBackupValidator } from './ZodBackupValidator';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const SPORT_KEYS = ['training', 'trainingPlans', 'sessionLogs', 'painReports'] as const;

/** Une vraie sauvegarde v4 avec du Sport : profil, programme, séance terminée, douleur. */
async function sportBackup(): Promise<Raw> {
  const ports = createInMemoryPorts({
    recipes: FIXTURE_RECIPES,
    exercises: EXERCISE_FIXTURES,
    clock: new FixedClock('2026-11-25T10:00:00.000Z'),
  });
  const uc = createUseCases(ports);
  await uc.saveProfile(makeProfile());
  await uc.saveTrainingProfile({
    ...defaultTrainingInput(),
    setting: 'maison-equipee',
    equipment: ['tapis', 'halteres', 'elastique'],
    level: 'intermediaire',
  });
  const week = await uc.getTrainingWeek();
  if (week.status !== 'ready') throw new Error('programme attendu');
  const session = week.plan.sessions.find((s) => s.main.length > 0);
  const slot = session?.main[0];
  if (!session || !slot) throw new Error('séance attendue');
  const ref = { weekStart: week.plan.weekStart, sessionId: session.id };
  await uc.startSession(ref);
  await uc.logSet({
    ...ref,
    slotId: slot.slotId,
    set: { index: 0, done: true, reps: 9, loadKg: 12.5 },
  });
  await uc.reportPain({ ...ref, slotId: slot.slotId });
  await uc.markExerciseDone({ ...ref, slotId: slot.slotId });
  await uc.completeSession({ ...ref, effort: 'correct' });
  await uc.exportData();
  return JSON.parse(ports.fileSaver.files[0]?.content ?? '') as Raw;
}

const errors = (raw: unknown): string => {
  const result = parseBackupFile(raw);
  return result.ok ? '' : result.errors.join('\n');
};
const clone = (raw: Raw): Raw => structuredClone(raw);

describe('migration 3 → 4', () => {
  it('SNAPSHOT_SCHEMA_VERSION vaut 4 et une migration part de la version 3', () => {
    expect(SNAPSHOT_SCHEMA_VERSION).toBe(4);
    expect(Object.keys(SNAPSHOT_MIGRATIONS).map(Number)).toEqual([1, 2, 3]);
  });

  it('un export v3 devient un export v4 sans Sport : listes vides, pas de profil sportif', async () => {
    const raw = await sportBackup();
    const v3 = clone(raw);
    for (const key of SPORT_KEYS) delete v3[key];
    v3['schemaVersion'] = 3;
    const result = parseBackupFile(v3);
    if (!result.ok) throw new Error(result.errors.join(' | '));
    expect(result.snapshot).toMatchObject({
      schemaVersion: 4,
      trainingPlans: [],
      sessionLogs: [],
      painReports: [],
    });
    expect(result.snapshot.training).toBeUndefined();
    expect(result.snapshot.profile).toEqual(raw['profile']);
  });

  it('les clés du Sport d’un fichier v3 sont écrasées, jamais reprises', async () => {
    const raw = await sportBackup();
    const v3 = { ...clone(raw), schemaVersion: 3 };
    const result = parseBackupFile(v3);
    if (!result.ok) throw new Error(result.errors.join(' | '));
    expect(result.snapshot.training).toBeUndefined();
    expect(result.snapshot.sessionLogs).toEqual([]);
  });

  it('v1 → v4 : toutes les migrations s’enchaînent', async () => {
    const raw = await sportBackup();
    const v1 = clone(raw);
    for (const key of [...SPORT_KEYS, 'companion']) delete v1[key];
    v1['schemaVersion'] = 1;
    v1['quiz'] = {
      seenIds: [],
      streak: 0,
      bestStreak: 0,
      daily: { date: '2026-11-23', questionId: 'q1' },
    };
    const result = parseBackupFile(v1);
    expect(result.ok && result.snapshot.schemaVersion).toBe(4);
  });
});

describe('aller-retour 4 → 4', () => {
  it('un export avec du Sport est relu à l’identique par le validateur Zod', async () => {
    const raw = await sportBackup();
    expect(raw['schemaVersion']).toBe(4);
    for (const key of SPORT_KEYS) expect(raw[key], key).toBeDefined();
    const result = parseBackupFile(raw);
    if (!result.ok) throw new Error(result.errors.join(' | '));
    const { app: _app, exportedAt: _at, ...expected } = raw;
    expect(JSON.parse(JSON.stringify(result.snapshot))).toEqual(expected);
    // Le validateur de la composition root rend le même résultat.
    const viaPort = await new ZodBackupValidator().parseBackup(raw);
    expect(viaPort).toEqual(result);
  });

  it('sans profil sportif : la clé `training` est absente et le fichier passe', async () => {
    const raw = await sportBackup();
    delete raw['training'];
    raw['trainingPlans'] = [];
    raw['sessionLogs'] = [];
    raw['painReports'] = [];
    expect(errors(raw)).toBe('');
  });

  it('ignore les clés inconnues sans les recopier', async () => {
    const raw = await sportBackup();
    raw['training']['inconnue'] = 1;
    raw['sessionLogs'][0]['espion'] = 'x';
    raw['sessionLogs'][0]['exercises'][0]['sets'][0]['autre'] = 2;
    const result = parseBackupFile(raw);
    if (!result.ok) throw new Error(result.errors.join(' | '));
    expect(JSON.stringify(result.snapshot)).not.toMatch(/espion|inconnue|"autre"/);
  });
});

describe('bornes et cohérence du Sport', () => {
  it('limites annoncées par l’ADR', () => {
    expect(BACKUP_LIMITS).toMatchObject({
      trainingPlans: 1_500,
      sessionLogs: 3_000,
      painReports: 500,
      exercisesPerSession: 60,
      setsPerExercise: 20,
      reps: 200,
      seconds: 3_600,
      loadKg: 500,
    });
  });

  const mutations: readonly [string, (raw: Raw) => void, string][] = [
    [
      'répétitions 201',
      (r) => (r['sessionLogs'][0].exercises[0].sets[0].reps = 201),
      'sessionLogs.0.exercises.0.sets.0.reps',
    ],
    [
      'répétitions négatives',
      (r) => (r['sessionLogs'][0].exercises[0].sets[0].reps = -1),
      'sets.0.reps',
    ],
    [
      'répétitions décimales',
      (r) => (r['sessionLogs'][0].exercises[0].sets[0].reps = 1.5),
      'sets.0.reps',
    ],
    [
      'secondes 3601',
      (r) => (r['sessionLogs'][0].exercises[0].sets[0].seconds = 3_601),
      'sets.0.seconds',
    ],
    [
      'charge 501 kg',
      (r) => (r['sessionLogs'][0].exercises[0].sets[0].loadKg = 501),
      'sets.0.loadKg',
    ],
    [
      'charge négative',
      (r) => (r['sessionLogs'][0].exercises[0].sets[0].loadKg = -2),
      'sets.0.loadKg',
    ],
    [
      '21 séries',
      (r) =>
        (r['sessionLogs'][0].exercises[0].sets = Array.from({ length: 21 }, (_, index) => ({
          index,
          done: false,
        }))),
      'sessionLogs.0.exercises.0.sets',
    ],
    [
      '61 exercices',
      (r) =>
        (r['sessionLogs'][0].exercises = Array.from({ length: 61 }, (_, i) => ({
          slotId: `s${i}`,
          exerciseId: 'pompes',
          sets: [],
          done: false,
        }))),
      'sessionLogs.0.exercises',
    ],
    [
      'index de série 20',
      (r) => (r['sessionLogs'][0].exercises[0].sets[0].index = 20),
      'sets.0.index',
    ],
    [
      'série en double',
      (r) => r['sessionLogs'][0].exercises[0].sets.push({ index: 0, done: false }),
      'série en double',
    ],
    [
      'créneau en double',
      (r) => r['sessionLogs'][0].exercises.push(clone(r['sessionLogs'][0].exercises[0])),
      'créneau en double',
    ],
    [
      'identifiant d’exercice hors format',
      (r) => (r['sessionLogs'][0].exercises[0].exerciseId = 'Pompes Rapides'),
      'exerciseId',
    ],
    [
      'identifiant d’exercice trop long',
      (r) => (r['painReports'][0].exerciseId = 'a'.repeat(121)),
      'exerciseId',
    ],
    ['ressenti inconnu', (r) => (r['sessionLogs'][0].effort = 'epique'), 'sessionLogs.0.effort'],
    ['statut inconnu', (r) => (r['sessionLogs'][0].status = 'annulee'), 'sessionLogs.0.status'],
    [
      'id du journal incohérent',
      (r) => (r['sessionLogs'][0].id = '2026-11-23:zz'),
      'identifiant incohérent',
    ],
    [
      'semaine du journal pas un lundi',
      (r) => {
        r['sessionLogs'][0].weekStart = '2026-11-24';
        r['sessionLogs'][0].id = `2026-11-24:${r['sessionLogs'][0].sessionId}`;
      },
      'un lundi est attendu',
    ],
    [
      'date avant la semaine',
      (r) => (r['sessionLogs'][0].date = '2026-11-22'),
      'date antérieure à la semaine',
    ],
    [
      'séance datée après l’export',
      (r) => (r['sessionLogs'][0].date = '2026-11-30'),
      'date postérieure à l’export',
    ],
    [
      'début après l’export',
      (r) => (r['sessionLogs'][0].startedAt = '2026-12-31T10:00:00.000Z'),
      'date postérieure à l’export',
    ],
    [
      'terminée sans fin',
      (r) => delete r['sessionLogs'][0].completedAt,
      'fin incohérente avec le statut',
    ],
    [
      'en cours avec une fin',
      (r) => (r['sessionLogs'][0].status = 'en-cours'),
      'fin incohérente avec le statut',
    ],
    [
      'fin avant le début',
      (r) => (r['sessionLogs'][0].completedAt = '2026-11-23T00:00:00.000Z'),
      'fin antérieure au début',
    ],
    [
      'journal en double',
      (r) => r['sessionLogs'].push(clone(r['sessionLogs'][0])),
      'journal en double',
    ],
    [
      'programme en double',
      (r) => r['trainingPlans'].push(clone(r['trainingPlans'][0])),
      'semaine en double',
    ],
    [
      'programme pas un lundi',
      (r) => (r['trainingPlans'][0].weekStart = '2026-11-24'),
      'un lundi est attendu',
    ],
    [
      'programme daté après l’export',
      (r) => (r['trainingPlans'][0].generatedAt = '2027-01-01T00:00:00.000Z'),
      'date postérieure à l’export',
    ],
    [
      '8 séances dans la semaine',
      (r) =>
        r['trainingPlans'][0].sessions.push(
          ...Array.from({ length: 8 }, (_, i) => ({
            ...clone(r['trainingPlans'][0].sessions[0]),
            id: `x${i}`,
          })),
        ),
      'trainingPlans.0.sessions',
    ],
    [
      'séance en double',
      (r) => r['trainingPlans'][0].sessions.push(clone(r['trainingPlans'][0].sessions[0])),
      'séance en double',
    ],
    [
      'date de séance incohérente',
      (r) => (r['trainingPlans'][0].sessions[0].date = '2026-12-24'),
      'date incohérente avec le jour de la séance',
    ],
    [
      'séries prescrites 0',
      (r) => (r['trainingPlans'][0].sessions[0].main[0].prescription.sets = 0),
      'prescription.sets',
    ],
    [
      'séries prescrites 21',
      (r) => (r['trainingPlans'][0].sessions[0].main[0].prescription.sets = 21),
      'prescription.sets',
    ],
    [
      'schéma inconnu',
      (r) => (r['trainingPlans'][0].sessions[0].main[0].pattern = 'saut'),
      'pattern',
    ],
    ['split inconnu', (r) => (r['trainingPlans'][0].split = 'bro-split'), 'trainingPlans.0.split'],
    [
      'conseil inconnu',
      (r) => (r['trainingPlans'][0].sessions[0].main[0].prescription.advice = 'force'),
      'advice',
    ],
    [
      'empreinte trop longue',
      (r) => (r['trainingPlans'][0].constraintsKey = 'k'.repeat(10_001)),
      'constraintsKey',
    ],
    [
      'douleur : id incohérent',
      (r) => (r['painReports'][0].id = 'autre'),
      'identifiant incohérent',
    ],
    [
      'douleur : muscle inconnu',
      (r) => (r['painReports'][0].muscles = ['cerveau']),
      'painReports.0.muscles',
    ],
    [
      'douleur datée après l’export',
      (r) => {
        r['painReports'][0].date = '2026-12-31';
        r['painReports'][0].id = `2026-12-31:${r['painReports'][0].exerciseId}`;
      },
      'date postérieure à l’export',
    ],
    [
      'douleur en double',
      (r) => r['painReports'].push(clone(r['painReports'][0])),
      'signalement en double',
    ],
    ['fréquence 7', (r) => (r['training'].frequency = 7), 'training.frequency'],
    [
      'jours en nombre différent',
      (r) => (r['training'].days = [0]),
      'autant de jours que de séances',
    ],
    ['jours non triés', (r) => (r['training'].days = [4, 2, 0]), 'jours triés et sans doublon'],
    ['jours en double', (r) => (r['training'].days = [0, 0, 2]), 'jours triés et sans doublon'],
    ['jour 7', (r) => (r['training'].days = [0, 2, 7]), 'training.days'],
    ['cadre inconnu', (r) => (r['training'].setting = 'plage'), 'training.setting'],
    ['matériel inconnu', (r) => (r['training'].equipment = ['canon']), 'training.equipment'],
    ['durée 25', (r) => (r['training'].sessionMinutes = 25), 'training.sessionMinutes'],
    [
      'étape de grossesse inconnue',
      (r) => (r['training'].pregnancyStage = 'bientot'),
      'training.pregnancyStage',
    ],
    ['début pas un lundi', (r) => (r['training'].startedOn = '2026-11-25'), 'un lundi est attendu'],
    [
      'accusé de lecture après l’export',
      (r) => (r['training'].safetyAcknowledgedOn = '2027-02-01'),
      'date postérieure à l’export',
    ],
    [
      'suggestion refusée après l’export',
      (r) => (r['settings'].activitySuggestionDismissedOn = '2027-02-01'),
      'date postérieure à l’export',
    ],
    [
      'suggestion refusée mal datée',
      (r) => (r['settings'].activitySuggestionDismissedOn = '2026-02-30'),
      'activitySuggestionDismissedOn',
    ],
    ['liste manquante', (r) => delete r['sessionLogs'], 'sessionLogs'],
    ['liste du mauvais type', (r) => (r['painReports'] = {}), 'painReports'],
  ];

  it.each(mutations)('refuse : %s', async (_name, mutate, expected) => {
    const raw = await sportBackup();
    mutate(raw);
    const message = errors(raw);
    expect(message, 'un fichier modifié doit être refusé').not.toBe('');
    expect(message).toContain(expected);
  });

  it('accepte les bornes exactes', async () => {
    const raw = await sportBackup();
    const set = raw['sessionLogs'][0].exercises[0].sets[0];
    Object.assign(set, { index: 19, reps: 200, seconds: 3_600, loadKg: 500 });
    expect(errors(raw)).toBe('');
  });

  it('refuse trop de journaux, de programmes ou de signalements', { timeout: 60_000 }, async () => {
    const raw = await sportBackup();
    const tooMany = (key: string, n: number) => {
      const copy = clone(raw);
      copy[key] = Array.from({ length: n }, (_, i) => ({
        ...clone(raw[key][0]),
        id: `x${i}`,
        weekStart: `2026-11-${i}`,
      }));
      return errors(copy);
    };
    expect(tooMany('sessionLogs', BACKUP_LIMITS.sessionLogs + 1)).toContain('sessionLogs');
    expect(tooMany('trainingPlans', BACKUP_LIMITS.trainingPlans + 1)).toContain('trainingPlans');
    expect(tooMany('painReports', BACKUP_LIMITS.painReports + 1)).toContain('painReports');
  });

  it('une valeur d’un type inattendu ne fait jamais lever', async () => {
    const raw = await sportBackup();
    for (const junk of [null, 42, 'texte', {}, true]) {
      for (const key of [...SPORT_KEYS]) {
        const copy = clone(raw);
        copy[key] = junk;
        expect(() => parseBackupFile(copy)).not.toThrow();
        expect(parseBackupFile(copy), `${key} = ${JSON.stringify(junk)}`).toMatchObject({
          ok: false,
        });
      }
    }
  });
});
