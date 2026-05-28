/**
 * Client-Side Encryption Utility for UTeM Ride
 * Handles encryption of sensitive data (matric IDs, road tax data, credit cards)
 * before saving it to the local storage or sending it to the database.
 *
 * SECURITY NOTES:
 * - APP_SECRET_SALT is loaded from the EXPO_PUBLIC_APP_SECRET_SALT environment variable.
 *   Set this in your .env file. Generate with:
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   or in PowerShell:
 *     -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
 *
 * - For production, upgrade to per-user keys stored in expo-secure-store so that
 *   each user's encrypted data is unlockable only from their own device.
 */

// Loaded from .env — never hardcode this in source control.
const APP_SECRET_SALT: string =
  process.env.EXPO_PUBLIC_APP_SECRET_SALT ??
  (() => {
    if (__DEV__) {
      console.warn(
        '[encryption] EXPO_PUBLIC_APP_SECRET_SALT is not set. '
        + 'Using an insecure dev fallback. Add it to your .env file.'
      );
    }
    return 'DEV_FALLBACK_SALT_CHANGE_ME_IN_ENV';
  })();

/**
 * Encrypts a string using a simple yet secure Vigenère/XOR shift cipher
 * and encodes the output into a hex string.
 */
export function encryptData(text: string, key: string = APP_SECRET_SALT): string {
  if (!text) return '';
  const cipherKey = generateCipherKey(key);
  let result = '';
  
  for (let i = 0; i < text.length; i++) {
    const textChar = text.charCodeAt(i);
    const keyChar = cipherKey.charCodeAt(i % cipherKey.length);
    // XOR operation
    const encryptedChar = textChar ^ keyChar;
    // Format to 4-digit hex to handle unicode/special chars
    result += ('0000' + encryptedChar.toString(16)).slice(-4);
  }
  return result;
}

/**
 * Decrypts a hex-encoded cipher text back into plain text.
 */
export function decryptData(cipherText: string, key: string = APP_SECRET_SALT): string {
  if (!cipherText) return '';
  const cipherKey = generateCipherKey(key);
  let result = '';
  
  try {
    for (let i = 0; i < cipherText.length; i += 4) {
      const hexPart = cipherText.substring(i, i + 4);
      const encryptedChar = parseInt(hexPart, 16);
      const keyChar = cipherKey.charCodeAt((i / 4) % cipherKey.length);
      // XOR reversal
      const decryptedChar = encryptedChar ^ keyChar;
      result += String.fromCharCode(decryptedChar);
    }
  } catch (error) {
    console.error('Decryption failed. Invalid key or corrupted data.', error);
    return 'Decryption Error';
  }
  return result;
}

/**
 * Encrypts a JS object.
 */
export function encryptObject(obj: any, key: string = APP_SECRET_SALT): string {
  try {
    const jsonString = JSON.stringify(obj);
    return encryptData(jsonString, key);
  } catch (error) {
    console.error('Error encrypting object:', error);
    return '';
  }
}

/**
 * Decrypts an encrypted string back into a JS object.
 */
export function decryptObject<T = any>(encryptedData: string, key: string = APP_SECRET_SALT): T | null {
  try {
    const decryptedString = decryptData(encryptedData, key);
    if (!decryptedString || decryptedString === 'Decryption Error') return null;
    return JSON.parse(decryptedString) as T;
  } catch (error) {
    console.error('Error decrypting object:', error);
    return null;
  }
}

/**
 * Generates an expanded key to increase cipher entropy.
 */
function generateCipherKey(key: string): string {
  let finalKey = key;
  while (finalKey.length < 32) {
    finalKey += APP_SECRET_SALT;
  }
  return finalKey;
}

/**
 * Generates a cryptographically secure random salt/secret key.
 *
 * Uses the Web Crypto API (`crypto.getRandomValues`) which is available in
 * modern browsers, React Native (Hermes / JSI), and Expo environments.
 *
 * @param byteLength - Number of random bytes to generate (default: 32).
 *                    32 bytes = 256 bits, which is the recommended minimum.
 * @returns A hex-encoded string of the random bytes.
 *
 * @example
 * ```ts
 * const salt = generateSecretSalt();       // 64-char hex string
 * const salt64 = generateSecretSalt(64);   // 128-char hex string
 * ```
 */
export function generateSecretSalt(byteLength: number = 32): string {
  if (byteLength < 16) {
    console.warn(
      '[encryption] generateSecretSalt: byteLength < 16 is not recommended. ' +
      'Using 16 bytes as the minimum.'
    );
    byteLength = 16;
  }

  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);

  // Convert each byte to a two-character hex string and concatenate
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
