import { describe, expect, it } from 'vitest';
import { createInMemoryPorts } from '../testing';
import { IMPORT_MAX_LENGTH, IMPORT_MESSAGES, PASSPHRASE_MIN_LENGTH, createUseCases } from '.';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';

const setup = async (withProfile = true) => {
  const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES });
  const uc = createUseCases(ports);
  if (withProfile) {
    await uc.saveProfile(makeProfile());
    await uc.getCurrentPlan();
    await uc.logProgress({ weightKg: 62 });
  }
  return { ports, uc };
};

const lastFile = (ports: Awaited<ReturnType<typeof setup>>['ports']) => {
  const file = ports.fileSaver.files.at(-1);
  if (!file) throw new Error('fichier attendu');
  return file;
};

describe('export', () => {
  it('exporte en JSON clair et date la sauvegarde', async () => {
    const { uc, ports } = await setup();
    await expect(uc.exportData()).resolves.toEqual({
      status: 'exported',
      fileName: 'nutry-sauvegarde-2026-11-23.json',
      encrypted: false,
    });
    const file = lastFile(ports);
    expect(file.mimeType).toBe('application/json');
    const content = JSON.parse(file.content) as Record<string, unknown>;
    expect(content).toMatchObject({
      app: 'nutry',
      schemaVersion: 1,
      exportedAt: '2026-11-23T10:00:00.000Z',
    });
    expect(ports.state.settings.lastBackupAt).toBe('2026-11-23T10:00:00.000Z');
  });

  it('chiffre avec une phrase secrète assez longue', async () => {
    const { uc, ports } = await setup();
    await expect(uc.exportData({ passphrase: 'court' })).resolves.toMatchObject({
      status: 'passphrase-too-short',
      minLength: PASSPHRASE_MIN_LENGTH,
    });
    expect(ports.fileSaver.files).toHaveLength(0);
    await expect(uc.exportData({ passphrase: 'une longue phrase' })).resolves.toMatchObject({
      fileName: 'nutry-sauvegarde-2026-11-23.nutry',
      encrypted: true,
    });
    expect(JSON.parse(lastFile(ports).content)).toMatchObject({ alg: 'AES-GCM' });
  });
});

describe('import', () => {
  it('restaure une sauvegarde en remplaçant tout', async () => {
    const source = await setup();
    await source.uc.exportData();
    const content = lastFile(source.ports).content;

    const target = await setup(false);
    await target.uc.setTheme('dark');
    target.ports.state.settings = { ...target.ports.state.settings, persistenceGranted: true };
    const result = await target.uc.importData({ content });
    expect(result).toEqual({
      status: 'imported',
      counts: { profile: true, plans: 1, ratings: 0, progress: 1 },
    });
    expect(target.ports.state.profile).toEqual(source.ports.state.profile);
    expect(target.uc.cachedTheme()).toBe('system');
    expect(target.ports.state.settings).toMatchObject({
      theme: 'system',
      lastBackupAt: '2026-11-23T10:00:00.000Z',
      persistenceGranted: true,
    });
  });

  it('demande puis vérifie la phrase secrète', async () => {
    const source = await setup();
    await source.uc.exportData({ passphrase: 'phrase secrète' });
    const content = lastFile(source.ports).content;
    const { uc, ports } = await setup(false);

    await expect(uc.importData({ content })).resolves.toEqual({
      status: 'passphrase-required',
      message: IMPORT_MESSAGES['passphrase-required'],
    });
    await expect(uc.importData({ content, passphrase: 'mauvaise phrase' })).resolves.toMatchObject({
      status: 'wrong-passphrase',
    });
    expect(ports.state.profile).toBeUndefined();
    await expect(uc.importData({ content, passphrase: 'phrase secrète' })).resolves.toMatchObject({
      status: 'imported',
    });
    expect(ports.state.profile).toBeDefined();
  });

  it('rejette les fichiers invalides sans rien toucher', async () => {
    const { uc, ports } = await setup();
    const before = ports.state.profile;
    const cases: [string, string][] = [
      ['pas du json', 'invalid'],
      [JSON.stringify({ hello: 'world' }), 'invalid'],
      [JSON.stringify({ app: 'nutry', schemaVersion: 99 }), 'future-version'],
      ['x'.repeat(IMPORT_MAX_LENGTH + 1), 'too-large'],
      [JSON.stringify({ alg: 'AES-GCM', salt: 'phrase-ok', data: '{oups' }), 'invalid'],
    ];
    for (const [content, status] of cases) {
      const result = await uc.importData({ content, passphrase: 'phrase-ok' });
      expect(result.status, content.slice(0, 30)).toBe(status);
    }
    expect(ports.state.profile).toBe(before);
  });

  it('rejette un profil incohérent même au bon format', async () => {
    const { uc, ports } = await setup();
    await uc.exportData();
    const file = JSON.parse(lastFile(ports).content) as Record<string, unknown>;
    const content = JSON.stringify({ ...file, profile: makeProfile({ householdSize: 0 }) });
    const result = await uc.importData({ content });
    expect(result).toMatchObject({ status: 'invalid' });
    expect(result.status === 'invalid' && result.errors?.[0]).toMatch(/householdSize/);
  });

  it('ramène l’objectif « perdre » à « rééquilibrer » pour un profil protégé importé', async () => {
    const { uc, ports } = await setup();
    await uc.exportData();
    const file = JSON.parse(lastFile(ports).content) as Record<string, unknown>;
    const minor = makeProfile({ age: 16, goal: 'perdre-en-douceur' });
    const result = await uc.importData({ content: JSON.stringify({ ...file, profile: minor }) });
    expect(result.status).toBe('imported');
    expect(ports.state.profile?.goal).toBe('reequilibrer');
  });

  it('un menu importé incompatible est régénéré à l’affichage', async () => {
    const { uc, ports } = await setup();
    await uc.exportData();
    const file = JSON.parse(lastFile(ports).content) as { profile: object };
    const allergic = { ...file, profile: { ...file.profile, allergens: ['poissons', 'lait'] } };
    await uc.importData({ content: JSON.stringify(allergic) });
    const view = await uc.getCurrentPlan();
    expect(view.status === 'ready' && view.origin).toBe('regenerated');
  });
});

describe('effacement et rappel de sauvegarde', () => {
  it('efface toutes les données', async () => {
    const { uc, ports } = await setup();
    await uc.wipeAllData();
    expect(ports.state.profile).toBeUndefined();
    expect(ports.state.plans.size).toBe(0);
    expect(ports.state.progress.size).toBe(0);
    await expect(uc.getProfile()).resolves.toBeUndefined();
  });

  it('efface aussi les valeurs gardées sur l’appareil (thème, session)', async () => {
    const { uc, ports } = await setup();
    await uc.setTheme('dark');
    uc.markDailyQuizShown();
    await uc.wipeAllData();
    expect(ports.device.values.local.size).toBe(0);
    expect(ports.device.values.session.size).toBe(0);
    expect(uc.cachedTheme()).toBeUndefined();
  });

  it('un effacement raté ne touche pas aux valeurs de l’appareil', async () => {
    const { uc, ports } = await setup();
    await uc.setTheme('dark');
    ports.userData.clearAll = () => Promise.reject(new Error('quota'));
    await expect(uc.wipeAllData()).resolves.toMatchObject({ status: 'failed' });
    expect(uc.cachedTheme()).toBe('dark');
  });

  it('le rappel masqué se tait jusqu’à la prochaine session', async () => {
    const { uc, ports } = await setup();
    ports.clock.set('2026-12-23T09:00:00.000Z');
    uc.dismissBackupReminder();
    await expect(uc.getBackupReminder()).resolves.toEqual({ due: false });
    expect(ports.state.settings.lastBackupReminderOn).toBeUndefined();
  });

  it('jamais sans profil', async () => {
    const { uc } = await setup(false);
    await expect(uc.getBackupReminder()).resolves.toEqual({ due: false });
  });

  it('rappelle 30 jours après l’onboarding, une journée, puis pas avant 30 jours', async () => {
    const { uc, ports } = await setup();
    await expect(uc.getBackupReminder()).resolves.toEqual({ due: false });

    ports.clock.set('2026-12-23T09:00:00.000Z');
    await expect(uc.getBackupReminder()).resolves.toEqual({ due: true });
    expect(ports.state.settings.lastBackupReminderOn).toBe('2026-12-23');
    ports.clock.set('2026-12-23T20:00:00.000Z');
    await expect(uc.getBackupReminder()).resolves.toEqual({ due: true });

    ports.clock.set('2026-12-24T09:00:00.000Z');
    await expect(uc.getBackupReminder()).resolves.toEqual({ due: false });

    await uc.exportData();
    ports.clock.set('2027-01-30T09:00:00.000Z');
    await expect(uc.getBackupReminder()).resolves.toEqual({
      due: true,
      lastBackupAt: '2026-12-24T09:00:00.000Z',
    });
  });
});
