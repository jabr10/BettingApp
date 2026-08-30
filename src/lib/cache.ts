import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Envelope<T> = {
  storedAt: number;
  ttlMs: number;
  value: T;
};

/** Writable on Vercel serverless (cwd is read-only except `/tmp`). */
export function cacheDir(): string {
  if (process.env.MATCHUP_CACHE_DIR) return process.env.MATCHUP_CACHE_DIR;
  if (process.env.VERCEL) return path.join("/tmp", "matchup-research-cache");
  return path.join(process.cwd(), ".cache");
}

export async function cacheGet<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const raw = await readFile(fileFor(key), "utf8");
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || typeof env.storedAt !== "number") return null;
    if (Date.now() - env.storedAt > ttlMs) return null;
    return env.value;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  try {
    const env: Envelope<T> = { storedAt: Date.now(), ttlMs, value };
    const file = fileFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(env), "utf8");
  } catch {
    // Never fail the request because the FS is read-only or /tmp is full.
  }
}

export async function cacheGetStale<T>(key: string): Promise<{ value: T; storedAt: number } | null> {
  try {
    const raw = await readFile(fileFor(key), "utf8");
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env) return null;
    return { value: env.value, storedAt: env.storedAt };
  } catch {
    return null;
  }
}

function fileFor(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9._=-]/g, "_");
  return path.join(cacheDir(), `${safe}.json`);
}
