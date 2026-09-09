const encoder = new TextEncoder();
// Keep hashes portable between the Workers Web Crypto runtime and Node.js Web Crypto.
const ITERATIONS = 100_000;

function base64url(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
  return `pbkdf2_sha256$${ITERATIONS}$${base64url(salt)}$${base64url(await derive(password, salt))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, iterations, saltValue, expectedValue] = stored.split("$");
  if (algorithm !== "pbkdf2_sha256" || Number(iterations) !== ITERATIONS || !saltValue || !expectedValue) return false;
  const actual = await derive(password, fromBase64url(saltValue));
  const expected = fromBase64url(expectedValue);
  if (actual.byteLength !== expected.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < actual.byteLength; index += 1) difference |= actual[index]! ^ expected[index]!;
  return difference === 0;
}

export function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256(value: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
