import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), ".cache");

type Envelope<T> = {
  storedAt: number;
  ttlMs: number;
  value: T;
};

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
  const env: Envelope<T> = { storedAt: Date.now(), ttlMs, value };
  const file = fileFor(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(env), "utf8");
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
  return path.join(ROOT, `${safe}.json`);
}
