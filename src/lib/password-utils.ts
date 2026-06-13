// ============================================================================
// Quantix Technology - Password Utilities (Server-Only)
// ============================================================================

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a human-friendly temporary password for delivery-partner onboarding.
 * Avoids ambiguous characters (0/O, 1/l/I) so it can be read aloud or shared
 * over WhatsApp without confusion. Format: Xxxx-9999 (8 usable chars).
 */
export function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (set: string, n: number) => {
    const arr = new Uint8Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr);
    else for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
    return Array.from(arr, (b) => set[b % set.length]).join('');
  };
  // e.g. "Kpra-7384" — 1 upper + 3 lower + dash + 4 digits
  return `${pick(upper, 1)}${pick(lower, 3)}-${pick(digits, 4)}`;
}

/**
 * Create a simple access token (for API usage, not JWT)
 */
export function createAccessToken(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < 32; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
