/**
 * Encryption utilities using Web Crypto API
 * Replaces Python cryptography library
 */

// Derive an AES key from the app secret
async function getKey(env) {
  const secret = env.ENCRYPTION_KEY || 'fundval-live-default-key-change-me';
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('fundval-live-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string value
 * Returns base64 encoded IV + ciphertext
 */
export async function encryptValue(value, env) {
  if (!value) return value;

  const key = await getKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(value);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  // Combine IV + ciphertext and base64 encode
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64 encoded value
 */
export async function decryptValue(encryptedValue, env) {
  if (!encryptedValue) return encryptedValue;

  try {
    const key = await getKey(env);
    const combined = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0));

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (e) {
    // If decryption fails (e.g., old format), return as-is
    return encryptedValue;
  }
}
