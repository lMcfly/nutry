import type { BackupParseResult, BackupValidator, EncryptedPayload } from '@application/ports';

/**
 * Validateur des imports. Le schéma (et Zod) est chargé à la demande : il ne pèse pas
 * sur le premier affichage.
 */
export class ZodBackupValidator implements BackupValidator {
  async parseBackup(raw: unknown): Promise<BackupParseResult> {
    const { parseBackupFile } = await import('./backupSchema');
    return parseBackupFile(raw);
  }

  async parseEncrypted(raw: unknown): Promise<EncryptedPayload | undefined> {
    const { parseEncryptedPayload } = await import('./backupSchema');
    return parseEncryptedPayload(raw);
  }
}
