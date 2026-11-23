/**
 * QA — décisions du coordinateur après la validation de la phase 4 : rappel en jours
 * locaux, échecs de stockage rendus en résultat, profil hors bornes refusé à l'import.
 */
import { describe, expect, it } from 'vitest';
import { FixedClock, createInMemoryPorts } from '../testing';
import { IMPORT_MESSAGES, STORAGE_FAILURE_MESSAGES, createUseCases } from '.';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';

const PARIS = 60; // UTC+1 en hiver

describe('QA rappel de sauvegarde en jours locaux', () => {
  it('non-régression : onboarding à 00 h 30 (Paris) compte pour le jour local', async () => {
    // 2026-10-24T23:30Z = 25 octobre 00 h 30 à Paris.
    const clock = new FixedClock('2026-10-24T23:30:00.000Z', PARIS);
    const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES, clock });
    const uc = createUseCases(ports);
    await uc.saveProfile(makeProfile());
    clock.set('2026-11-23T10:00:00.000Z'); // 29 jours locaux plus tard
    expect((await uc.getBackupReminder()).due).toBe(false);
    clock.set('2026-11-24T10:00:00.000Z'); // 30 jours
    expect((await uc.getBackupReminder()).due).toBe(true);
  });

  it('le jour du rappel montré est aussi local (23 h 30 UTC = lendemain à Paris)', async () => {
    const clock = new FixedClock('2026-09-01T10:00:00.000Z', PARIS);
    const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES, clock });
    const uc = createUseCases(ports);
    await uc.saveProfile(makeProfile());
    clock.set('2026-11-23T23:30:00.000Z');
    expect((await uc.getBackupReminder()).due).toBe(true);
    expect(ports.state.settings.lastBackupReminderOn).toBe('2026-11-24');
  });
});

describe('QA échecs de stockage', () => {
  const setup = async () => {
    const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES });
    const uc = createUseCases(ports);
    await uc.saveProfile(makeProfile());
    await uc.exportData();
    return { ports, uc, content: ports.fileSaver.files[0]?.content ?? '' };
  };
  const boom = () => Promise.reject(new Error('QuotaExceededError'));

  it('import : { status: failed } et données intactes', async () => {
    const { ports, uc, content } = await setup();
    const before = JSON.stringify(await ports.userData.exportAll());
    ports.userData.importAll = boom;
    await expect(uc.importData({ content })).resolves.toEqual({
      status: 'failed',
      message: IMPORT_MESSAGES.failed,
    });
    expect(JSON.stringify(await ports.userData.exportAll())).toBe(before);
    // Le validateur (chargé à la demande) peut aussi échouer hors ligne.
    ports.backupValidator.parseEncrypted = boom;
    await expect(uc.importData({ content })).resolves.toMatchObject({ status: 'failed' });
  });

  it('export : lecture ou téléchargement en échec → failed, rien de noté', async () => {
    const { ports, uc } = await setup();
    const lastBackupAt = ports.state.settings.lastBackupAt;
    ports.clock.set('2026-11-24T10:00:00.000Z');
    ports.fileSaver.save = boom;
    await expect(uc.exportData()).resolves.toEqual({
      status: 'failed',
      message: STORAGE_FAILURE_MESSAGES.export,
    });
    expect(ports.state.settings.lastBackupAt).toBe(lastBackupAt);
  });

  it('export : fichier remis même si la date de sauvegarde ne peut être notée', async () => {
    const { ports, uc } = await setup();
    ports.settings.save = boom;
    await expect(uc.exportData()).resolves.toMatchObject({ status: 'exported' });
    expect(ports.fileSaver.files).toHaveLength(2);
  });

  it('tout effacer : failed sans rien effacer ; wiped sinon', async () => {
    const { ports, uc } = await setup();
    const clearAll = ports.userData.clearAll.bind(ports.userData);
    ports.userData.clearAll = boom;
    await expect(uc.wipeAllData()).resolves.toEqual({
      status: 'failed',
      message: STORAGE_FAILURE_MESSAGES.wipe,
    });
    expect(ports.state.profile).toBeDefined();
    ports.userData.clearAll = clearAll;
    await uc.requestPersistentStorage();
    ports.settings.save = boom; // le réglage d'appareil ne peut être remis : effacé quand même
    await expect(uc.wipeAllData()).resolves.toEqual({ status: 'wiped' });
    expect(ports.state.profile).toBeUndefined();
  });
});

describe('QA import d’un profil hors bornes', () => {
  it.each([
    ['âge', { age: 400 }],
    ['foyer', { householdSize: 1_000_000_000 }],
    ['temps', { weekdayMinutes: 0 }],
    ['poids', { weightKg: 20 }],
  ])('%s : refusé, rien ne change', async (_label, change) => {
    const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES });
    const uc = createUseCases(ports);
    await uc.saveProfile(makeProfile());
    await uc.exportData();
    const file = JSON.parse(ports.fileSaver.files[0]?.content ?? '') as Record<string, unknown>;
    const content = JSON.stringify({ ...file, profile: makeProfile(change) });
    const result = await uc.importData({ content });
    expect(result.status).toBe('invalid');
    expect(ports.state.profile).toEqual(makeProfile());
  });
});
