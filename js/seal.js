const SALT = new TextEncoder().encode('de_contract/v1/salt');
const ITER = 150000;
const sub = globalThis.crypto.subtle;

export async function deriveKey(pass) {
  const base = await sub.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return sub.deriveKey({ name: 'PBKDF2', salt: SALT, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(key, bytes) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await sub.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return out;
}

export async function open(key, bytes) {
  const b = new Uint8Array(bytes);
  return new Uint8Array(await sub.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, key, b.slice(12)));
}

export const CHECK = 'bomb has been defused';
