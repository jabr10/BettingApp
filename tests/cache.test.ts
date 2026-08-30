import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cacheDir, cacheGet, cacheSet } from "../src/lib/cache";

const prev = {
  vercel: process.env.VERCEL,
  dir: process.env.MATCHUP_CACHE_DIR,
};

afterEach(() => {
  restore("VERCEL", prev.vercel);
  restore("MATCHUP_CACHE_DIR", prev.dir);
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("cache", () => {
  it("uses /tmp on Vercel", () => {
    delete process.env.MATCHUP_CACHE_DIR;
    process.env.VERCEL = "1";
    expect(cacheDir()).toBe(path.join("/tmp", "matchup-research-cache"));
  });

  it("uses cwd/.cache off Vercel", () => {
    delete process.env.MATCHUP_CACHE_DIR;
    delete process.env.VERCEL;
    expect(cacheDir()).toBe(path.join(process.cwd(), ".cache"));
  });

  it("round-trips a value when the directory is writable", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "matchup-cache-"));
    process.env.MATCHUP_CACHE_DIR = dir;
    const key = `roundtrip-${Date.now()}`;
    await cacheSet(key, { n: 7 }, 60_000);
    await expect(cacheGet<{ n: number }>(key, 60_000)).resolves.toEqual({ n: 7 });
    await rm(dir, { recursive: true, force: true });
  });

  it("cacheSet does not throw when the filesystem rejects the write", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "matchup-cache-"));
    const notADir = path.join(dir, "not-a-directory");
    await writeFile(notADir, "x", "utf8");
    process.env.MATCHUP_CACHE_DIR = notADir;
    await expect(cacheSet("should-fail", { ok: false }, 1000)).resolves.toBeUndefined();
    await expect(cacheGet("should-fail", 1000)).resolves.toBeNull();
    await rm(dir, { recursive: true, force: true });
  });

  it("cacheGet returns null for a corrupt file", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "matchup-cache-"));
    process.env.MATCHUP_CACHE_DIR = dir;
    await writeFile(path.join(dir, "bad.json"), "{not-json", "utf8");
    await expect(cacheGet("bad", 1000)).resolves.toBeNull();
    await rm(dir, { recursive: true, force: true });
  });
});
