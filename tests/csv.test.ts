import { describe, expect, it } from "vitest";
import { parseCsv, num } from "../src/lib/csv";

describe("parseCsv", () => {
  it("keeps commas inside quoted names and strips BOM", () => {
    const text =
      '\uFEFF"last_name, first_name","player_id","est_woba"\n"Trout, Mike",545361,"0.400"\n';
    const rows = parseCsv(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]!["last_name, first_name"]).toBe("Trout, Mike");
    expect(num(rows[0]!.est_woba)).toBeCloseTo(0.4);
  });

  it("rejects HTML error pages instead of inventing rows", () => {
    expect(() => parseCsv("<!DOCTYPE html><html>nope</html>")).toThrow(/HTML/);
  });
});
