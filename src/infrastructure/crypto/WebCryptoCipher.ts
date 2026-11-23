import type { Cipher, EncryptedPayload } from '@application/ports';

/** Itérations PBKDF2 par défaut (recommandation OWASP 2023 pour PBKDF2-HMAC-SHA256). */
export const PBKDF2_ITERATIONS = 600_000;
/** En dessous, une sauvegarde est refusée (plancher demandé : 310 000). */
export const PBKDF2_MIN_ITERATIONS = 310_000;
/** Au-delà, une sauvegarde est refusée (évite de bloquer l'appareil sur un fichier piégé). */
export const PBKDF2_MAX_ITERATIONS = 5_000_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;

export const CIPHER_MESSAGES = {
  wrongPassphrase:
    'Déchiffrement impossible : la phrase secrète est incorrecte ou le fichier a été modifié.',
  unsupported: 'Format de sauvegarde chiffrée non pris en charge.',
} as const;

export class DecryptionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DecryptionError';
  }
}

const CHUNK = 0x8000;

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Chiffrement local par phrase secrète (Web Crypto) : AES-GCM 256 bits, clé dérivée par
 * PBKDF2-SHA256, sel (16 octets) et IV (12 octets) aléatoires à chaque export.
 * AES-GCM authentifie les données : toute altération fait échouer le déchiffrement.
 */
export class WebCryptoCipher implements Cipher {
  private readonly iterations: number;

  constructor(
    private readonly crypto: Crypto = globalThis.crypto,
    options: { readonly iterations?: number } = {},
  ) {
    this.iterations = options.iterations ?? PBKDF2_ITERATIONS;
    if (this.iterations < PBKDF2_MIN_ITERATIONS || this.iterations > PBKDF2_MAX_ITERATIONS) {
      throw new RangeError(
        `Itérations PBKDF2 hors limites [${PBKDF2_MIN_ITERATIONS}, ${PBKDF2_MAX_ITERATIONS}]`,
      );
    }
  }

  async encrypt(plaintext: string, passphrase: string): Promise<EncryptedPayload> {
    const salt = this.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = this.crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await this.deriveKey(passphrase, salt, this.iterations, 'encrypt');
    const data = await this.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext),
    );
    return {
      v: 1,
      alg: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iter: this.iterations,
      salt: toBase64(salt),
      iv: toBase64(iv),
      data: toBase64(new Uint8Array(data)),
    };
  }

  async decrypt(payload: EncryptedPayload, passphrase: string): Promise<string> {
    // Le payload vient d'un fichier : on revérifie son en-tête malgré le type.
    const header = payload as { readonly [K in keyof EncryptedPayload]: unknown };
    const supported =
      header.v === 1 &&
      header.alg === 'AES-GCM' &&
      header.kdf === 'PBKDF2-SHA256' &&
      Number.isInteger(header.iter) &&
      payload.iter >= PBKDF2_MIN_ITERATIONS &&
      payload.iter <= PBKDF2_MAX_ITERATIONS;
    if (!supported) throw new DecryptionError(CIPHER_MESSAGES.unsupported);

    let salt: Uint8Array<ArrayBuffer>, iv: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>;
    try {
      salt = fromBase64(payload.salt);
      iv = fromBase64(payload.iv);
      data = fromBase64(payload.data);
    } catch (cause) {
      throw new DecryptionError(CIPHER_MESSAGES.wrongPassphrase, { cause });
    }
    if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES) {
      throw new DecryptionError(CIPHER_MESSAGES.wrongPassphrase);
    }
    try {
      const key = await this.deriveKey(passphrase, salt, payload.iter, 'decrypt');
      const plain = await this.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      return new TextDecoder('utf-8', { fatal: true }).decode(plain);
    } catch (cause) {
      throw new DecryptionError(CIPHER_MESSAGES.wrongPassphrase, { cause });
    }
  }

  private async deriveKey(
    passphrase: string,
    salt: Uint8Array<ArrayBuffer>,
    iterations: number,
    usage: KeyUsage,
  ): Promise<CryptoKey> {
    const material = await this.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase.normalize('NFC')),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return this.crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      material,
      { name: 'AES-GCM', length: KEY_BITS },
      false,
      [usage],
    );
  }
}
