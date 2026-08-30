import { describe, expect, it } from "vitest";
import { projectLineup } from "../src/lib/mlb";
import type { PastTeamGame } from "../src/lib/types";

function game(date: string, names: string[], throws: "L" | "R"): PastTeamGame {
  return {
    gamePk: Number(date.replaceAll("-", "")),
    date,
    teamId: 119,
    opponentId: 1,
    opponentStarterId: 1,
    opponentThrows: throws,
    lineup: names.map((fullName, i) => ({ id: 100 + i, fullName, position: "OF" })),
  };
}

describe("projectLineup", () => {
  it("does not repeat a batter across slots", () => {
    const recent: PastTeamGame[] = [
      game("2026-08-29", ["A", "B", "C", "D", "E", "F", "G", "H", "I"], "L"),
      game("2026-08-28", ["A", "C", "B", "D", "E", "F", "G", "H", "I"], "L"),
      game("2026-08-27", ["A", "B", "C", "D", "E", "F", "G", "H", "I"], "L"),
    ];
    // Force same player id in two slots in the counting map by reusing ids.
    recent[1]!.lineup[2] = { ...recent[1]!.lineup[0]!, position: "DH" };
    const { lineup } = projectLineup(recent, "L");
    const ids = lineup.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(8);
  });
});
