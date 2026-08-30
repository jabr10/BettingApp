import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const SKIP = new Set(["node_modules", ".git", ".next", ".cache"]);

const FORBIDDEN = [
  /\block\b/i,
  /\bguaranteed\b/i,
  /\+EV\b/,
  /\bmoneyline\b/i,
  /\brun line\b/i,
  /\bfull-game total\b/i,
  /last-7-day BA/i,
  /he's due/i,
  /he’s due/i,
  /\bCLV\b/,
  /beat the market/i,
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts|md|css)$/.test(name)) acc.push(p);
  }
  return acc;
}

describe("forbidden marketing copy", () => {
  it("does not appear as a product claim (README may mention the ban list)", () => {
    const files = walk(path.join(ROOT, "src"));
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const re of FORBIDDEN) {
        if (re.test(text)) hits.push(`${path.relative(ROOT, file)} :: ${re}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
