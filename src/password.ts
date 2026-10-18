import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const MIN_LENGTH = 8;
const MAX_LENGTH = 12;

export function createPasswordConfig(plain: string) {
  const length = [...plain].length;
  if (length < MIN_LENGTH || length > MAX_LENGTH) {
    throw new Error(`비밀번호는 ${MIN_LENGTH}~${MAX_LENGTH}자여야 합니다.`);
  }
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEY_LENGTH);
  return {
    passwordHash: `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`,
    sessionSecret: randomBytes(32).toString("base64"),
  };
}

export function verifyPassword(plain: string, passwordHash: string): boolean {
  const [scheme, saltB64, hashB64] = passwordHash.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(plain, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}
