import type { Env } from "../env";
import { errors } from "../lib/errors";
import { sha256Hex, timingSafeEqual } from "../lib/hash";

export async function createSessionToken(env: Env): Promise<string> {
  if (!env.ADMIN_PASSWORD) throw errors.authFailed();
  return sha256Hex(`${env.ADMIN_USERNAME}:${env.ADMIN_PASSWORD}:session`);
}

export async function validateAdminToken(env: Env, token: string | null): Promise<boolean> {
  if (!token) return false;

  if (env.ADMIN_TOKEN && timingSafeEqual(token, env.ADMIN_TOKEN)) {
    return true;
  }

  if (!env.ADMIN_PASSWORD) return false;
  const expected = await createSessionToken(env);
  return timingSafeEqual(token, expected);
}

export async function validateAdminCredentials(
  env: Env,
  username: string,
  password: string,
): Promise<string | null> {
  if (!env.ADMIN_PASSWORD) return null;
  if (!timingSafeEqual(username, env.ADMIN_USERNAME || "admin")) return null;
  if (!timingSafeEqual(password, env.ADMIN_PASSWORD)) return null;
  return createSessionToken(env);
}

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}
