const encoder = new TextEncoder();

export const PASSWORD_ITERATIONS = 210_000;
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function cleanText(value: unknown, maxLength = 160) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    : '';
}

export function normalizeEmail(value: unknown) {
  return cleanText(value, 254).toLocaleLowerCase('en-US');
}

export function normalizeName(value: unknown) {
  return cleanText(value).toLocaleLowerCase('en-US');
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function isValidPassword(password: unknown) {
  return (
    typeof password === 'string' &&
    password.length >= 12 &&
    password.length <= 128
  );
}

export function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return toBase64Url(bytes);
}

export function recordId() {
  return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
}

export async function sha256(value: string) {
  return toBase64Url(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(value)),
    ),
  );
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PASSWORD_ITERATIONS,
    },
    key,
    256,
  );
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterationText, saltText, expectedText] = stored.split('$');
  const iterations = Number(iterationText);
  if (
    algorithm !== 'pbkdf2_sha256' ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    !saltText ||
    !expectedText
  )
    return false;
  const salt = fromBase64Url(saltText);
  const expected = fromBase64Url(expectedText);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      key,
      expected.length * 8,
    ),
  );
  return constantTimeBytesEqual(actual, expected);
}

export function isSafeReturnTo(value: string | null | undefined) {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//'));
}

export function hasSafeRequestOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) return origin === new URL(request.url).origin;
  const fetchSite = request.headers.get('sec-fetch-site');
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none';
}

export function constantTimeTextEqual(left: string, right: string) {
  return constantTimeBytesEqual(encoder.encode(left), encoder.encode(right));
}

function constantTimeBytesEqual(left: Uint8Array, right: Uint8Array) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1)
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
