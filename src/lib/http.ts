import { USER_AGENT } from "./constants";

const SAVANT_HOST = "baseballsavant.mlb.com";

let savantChain: Promise<void> = Promise.resolve();

function enqueueSavant<T>(fn: () => Promise<T>): Promise<T> {
  const run = savantChain.then(fn, fn);
  savantChain = run.then(
    () => sleep(400),
    () => sleep(400),
  );
  return run;
}

export async function fetchText(
  url: string,
  opts: { timeoutMs?: number; retries?: number } = {},
): Promise<string> {
  const host = new URL(url).host;
  const exec = () => fetchTextOnce(url, opts);
  if (host === SAVANT_HOST) return enqueueSavant(exec);
  return exec();
}

async function fetchTextOnce(
  url: string,
  opts: { timeoutMs?: number; retries?: number },
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const retries = opts.retries ?? 2;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/csv,application/json,text/plain,*/*",
        },
        cache: "no-store",
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) await sleep(800 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error(`Failed ${url}`);
}

export async function fetchJson<T>(url: string): Promise<T> {
  const text = await fetchText(url, { timeoutMs: 30_000 });
  return JSON.parse(text) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
