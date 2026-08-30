import { describe, expect, it } from "vitest";
import { ROUTE_MAX_DURATION_SECONDS } from "../src/lib/constants";
import { gameFromSchedule } from "../src/lib/slate";
import { emptySavantStore, savantStoreIsUsable } from "../src/lib/savant";
import type { ScheduleGame } from "../src/lib/mlb";

function game(partial: Partial<ScheduleGame> & Pick<ScheduleGame, "gamePk">): ScheduleGame {
  return {
    gameDate: "2026-08-30T17:10:00Z",
    venue: { name: "Fenway Park" },
    status: { detailedState: "Scheduled" },
    teams: {
      away: { team: { id: 111, name: "Boston Red Sox", abbreviation: "BOS" } },
      home: {
        team: { id: 147, name: "New York Yankees", abbreviation: "NYY" },
        probablePitcher: { id: 1, fullName: "Gerrit Cole" },
      },
    },
    ...partial,
  };
}

describe("gameFromSchedule", () => {
  it("builds a slate card from the MLB schedule without mix or chips", () => {
    const card = gameFromSchedule(
      game({
        gamePk: 42,
        lineups: {
          awayPlayers: Array.from({ length: 9 }, (_, i) => ({
            id: 200 + i,
            fullName: `Away ${i + 1}`,
            primaryPosition: { abbreviation: "OF" },
          })),
        },
      }),
    );
    expect(card.gamePk).toBe(42);
    expect(card.park).toBe("Fenway Park");
    expect(card.away.abbreviation).toBe("BOS");
    expect(card.home.abbreviation).toBe("NYY");
    expect(card.home.starter.name).toBe("Gerrit Cole");
    expect(card.home.starter.mix).toEqual([]);
    expect(card.chips).toEqual([]);
    expect(card.away.lineupState).toBe("Official");
    expect(card.home.lineupState).toBe("Not posted");
    expect(card.lineupState).toBe("Split");
    expect(card.away.lineup).toHaveLength(9);
    expect(card.away.lineup[0]?.edges.hitsXwobaPoints).toBeNull();
  });

  it("marks both sides not posted when lineups are missing", () => {
    const card = gameFromSchedule(game({ gamePk: 7 }));
    expect(card.away.lineupState).toBe("Not posted");
    expect(card.home.lineupState).toBe("Not posted");
    expect(card.lineupState).toBe("Not posted");
  });
});

describe("savant store helpers", () => {
  it("treats an empty store as unusable so it is not cached as a daily leaderboard", () => {
    const store = emptySavantStore();
    expect(savantStoreIsUsable(store)).toBe(false);
    store.pitcherUsage.set(1, { FF: 80 });
    expect(savantStoreIsUsable(store)).toBe(true);
  });
});

describe("route duration", () => {
  it("is the Hobby maximum so a remaining Savant miss can finish after first paint", () => {
    expect(ROUTE_MAX_DURATION_SECONDS).toBe(60);
  });
});
