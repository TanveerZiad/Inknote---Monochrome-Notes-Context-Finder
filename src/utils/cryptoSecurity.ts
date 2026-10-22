import { NoteItem, SecurityConfig } from '../types/workspace';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const bytesToBase64 = (bytes: Uint8Array): string => {
  // Node.js environment: use Buffer (prevents "Maximum call stack size exceeded" on large payloads)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  // Browser environment: safe loop to avoid call stack limits
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const base64ToBytes = (value: string): Uint8Array => {
  // 1. Normalize URL-safe base64 to standard base64 (replaces - and _ with + and /)
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');

  // 2. Ensure proper padding (atob requires length to be a multiple of 4)
  const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');

  // 3. Decode safely
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'));
  }

  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const cryptoBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export async function passcodeVerifier(passcode: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passcode), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: cryptoBuffer(salt), iterations: 210000 },
    material,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

export async function encryptionKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: cryptoBuffer(salt), iterations: 210000 },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptNotePayload(
  note: Pick<NoteItem, 'title' | 'content' | 'tags'>,
  passcode: string,
  salt: Uint8Array
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(passcode, salt);
  const plain = encoder.encode(
    JSON.stringify({
      title: note.title,
      content: note.content,
      tags: note.tags ?? [],
    })
  );
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipher))}`;
}

export async function decryptNotePayload(
  payload: string,
  passcode: string,
  salt: Uint8Array
): Promise<Pick<NoteItem, 'title' | 'content' | 'tags'>> {
  const [ivValue, cipherValue] = payload.split('.');
  if (!ivValue || !cipherValue) {
    throw new Error('Invalid encrypted payload structure');
  }

  // 🔍 EXPLICIT IV VALIDATION: This will catch the exact issue and give you a clear error message
  const ivBytes = base64ToBytes(ivValue);
  if (ivBytes.length !== 12) {
    throw new Error(
      `Invalid IV length: expected 12 bytes, but got ${ivBytes.length}. ` +
      `The ivValue ("${ivValue}") may be corrupted, truncated, or improperly encoded.`
    );
  }

  const key = await encryptionKey(passcode, salt);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    base64ToBytes(cipherValue)
  );

  return JSON.parse(decoder.decode(plain)) as Pick<NoteItem, 'title' | 'content' | 'tags'>;
}