import { describe, expect, it } from 'vitest';
import {
  CIPHER_MESSAGES,
  DecryptionError,
  PBKDF2_ITERATIONS,
  WebCryptoCipher,
  fromBase64,
  toBase64,
} from './WebCryptoCipher';

const cipher = new WebCryptoCipher();
const SECRET = 'Une phrase secrète, avec des accents é è ç';
const TEXT = JSON.stringify({ app: 'nutry', note: 'Données privées 🍲', n: [1, 2, 3] });

describe('WebCryptoCipher', () => {
  it('aller-retour avec la bonne phrase', async () => {
    const payload = await cipher.encrypt(TEXT, SECRET);
    expect(payload).toMatchObject({
      v: 1,
      alg: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iter: PBKDF2_ITERATIONS,
    });
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(310_000);
    expect(fromBase64(payload.salt)).toHaveLength(16);
    expect(fromBase64(payload.iv)).toHaveLength(12);
    expect(payload.data).not.toContain('nutry');
    // Sérialisable tel quel.
    const roundTrip = JSON.parse(JSON.stringify(payload)) as typeof payload;
    await expect(cipher.decrypt(roundTrip, SECRET)).resolves.toBe(TEXT);
  });

  it('sel et IV différents à chaque chiffrement', async () => {
    const a = await cipher.encrypt(TEXT, SECRET);
    const b = await cipher.encrypt(TEXT, SECRET);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('mauvaise phrase : erreur claire', async () => {
    const payload = await cipher.encrypt(TEXT, SECRET);
    const attempt = cipher.decrypt(payload, 'pas la bonne phrase');
    await expect(attempt).rejects.toBeInstanceOf(DecryptionError);
    await expect(cipher.decrypt(payload, 'pas la bonne phrase')).rejects.toThrow(
      CIPHER_MESSAGES.wrongPassphrase,
    );
  });

  it('données, IV ou sel altérés : erreur', async () => {
    const payload = await cipher.encrypt(TEXT, SECRET);
    const data = fromBase64(payload.data);
    data[0] = (data[0] ?? 0) ^ 1;
    const tampered = [
      { ...payload, data: toBase64(data) },
      { ...payload, iv: toBase64(new Uint8Array(12)) },
      { ...payload, salt: toBase64(new Uint8Array(16)) },
      { ...payload, iv: toBase64(new Uint8Array(4)) },
      { ...payload, data: '%%% pas du base64 %%%' },
    ];
    for (const altered of tampered) {
      await expect(cipher.decrypt(altered, SECRET)).rejects.toThrow(
        CIPHER_MESSAGES.wrongPassphrase,
      );
    }
  });

  it('refuse un format inconnu ou un nombre d’itérations hors limites', async () => {
    const payload = await cipher.encrypt(TEXT, SECRET);
    for (const iter of [1000, 10_000_000, 1.5]) {
      await expect(cipher.decrypt({ ...payload, iter }, SECRET)).rejects.toThrow(
        CIPHER_MESSAGES.unsupported,
      );
    }
    const wrongAlg = { ...payload, alg: 'AES-CBC' } as unknown as typeof payload;
    await expect(cipher.decrypt(wrongAlg, SECRET)).rejects.toThrow(CIPHER_MESSAGES.unsupported);
    expect(() => new WebCryptoCipher(globalThis.crypto, { iterations: 1000 })).toThrow(RangeError);
  });

  it('base64 sur de gros volumes', () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 256);
    expect(fromBase64(toBase64(big))).toEqual(big);
  });
});
