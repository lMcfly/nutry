/**
 * Données chiffrées, sérialisables en JSON : AES-GCM 256 bits, clé dérivée de la phrase
 * secrète par PBKDF2-SHA256. `salt`, `iv` et `data` sont en base64.
 */
export interface EncryptedPayload {
  readonly v: 1;
  readonly alg: 'AES-GCM';
  readonly kdf: 'PBKDF2-SHA256';
  readonly iter: number;
  readonly salt: string;
  readonly iv: string;
  readonly data: string;
}

/** Chiffrement par phrase secrète, entièrement local. */
export interface Cipher {
  encrypt(plaintext: string, passphrase: string): Promise<EncryptedPayload>;
  /** Rejette (Error au message clair) si la phrase est fausse ou les données altérées. */
  decrypt(payload: EncryptedPayload, passphrase: string): Promise<string>;
}
