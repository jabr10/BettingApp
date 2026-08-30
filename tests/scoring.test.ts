import { describe, expect, it } from "vitest";
import {
  buildPitcherMix,
  chipStrength,
  chipsForEdges,
  comparisonPaForMix,
  edgesFromProj,
  pickGameChips,
  projectBatter,
  rollupMix,
  shrink,
  standVsPitcher,
  toUsageShare,
} from "../src/lib/scoring";
import { CHIP_THRESHOLDS, PITCHER_QUALITY_DAMPENER } from "../src/lib/constants";
import type { LeagueBaseline, PitchRates } from "../src/lib/types";

const vsHand: PitchRates = {
  xwoba: 0.32,
  xba: 0.25,
  xslg: 0.42,
  whiff: 24,
  barrel: 8,
  hardHit: 40,
  rv100: 0,
  pa: 400,
  pitches: 1600,
};

const league: LeagueBaseline = {
  hand: "R",
  xwoba: 0.32,
  xba: 0.25,
  xslg: 0.42,
  whiff: 24,
  barrel: 8,
  pa: 100000,
};

function rates(partial: Partial<PitchRates>): PitchRates {
  return {
    xwoba: 0.32,
    xba: 0.25,
    xslg: 0.42,
    whiff: 24,
    barrel: 8,
    hardHit: 40,
    rv100: 0,
    pa: 80,
    pitches: 300,
    ...partial,
  };
}

describe("toUsageShare / rollupMix", () => {
  it("converts percent usage to shares and rolls types under 8% plus non-core into Other", () => {
    const { kept, other, otherTypes } = rollupMix({
      FF: 42,
      ST: 31,
      SL: 12,
      CH: 7,
      KN: 8,
    });
    expect(kept.FF).toBeCloseTo(0.42, 2);
    expect(kept.ST).toBeCloseTo(0.31, 2);
    expect(kept.SL).toBeCloseTo(0.12, 2);
    expect(kept.CH).toBeUndefined();
    expect(kept.KN).toBeUndefined();
    expect(other).toBeCloseTo(0.15, 2);
    expect(otherTypes.sort()).toEqual(["CH", "KN"]);
  });

  it("normalizes already-share inputs", () => {
    const shares = toUsageShare({ FF: 0.6, SI: 0.4 });
    expect(shares.FF).toBeCloseTo(0.6);
    expect(shares.SI).toBeCloseTo(0.4);
  });
});

describe("shrink", () => {
  it("uses PA_prior 80 for xwOBA toward the vs-hand mean", () => {
    // (40*0.400 + 80*0.320) / 120 = 0.34666...
    expect(shrink(0.4, 40, 0.32, 80)).toBeCloseTo((40 * 0.4 + 80 * 0.32) / 120);
  });

  it("returns the prior when the vs-type sample is missing", () => {
    expect(shrink(null, 0, 0.31, 80)).toBe(0.31);
  });
});

describe("projectBatter", () => {
  it("projects as usage-weighted shrunk vs-type rates", () => {
    const vsType = new Map<string, PitchRates>([
      ["ST", rates({ xwoba: 0.44, pa: 62 })],
      ["FF", rates({ xwoba: 0.3, pa: 90 })],
    ]);
    const { mix, otherUsage } = buildPitcherMix({ FF: 59, ST: 41 }, new Map());
    expect(otherUsage).toBeCloseTo(0);
    const { proj, comparisonPa, confidence } = projectBatter({
      mix,
      otherTypes: [],
      batterVsType: vsType,
      vsHand,
    });
    const shrunkST = shrink(0.44, 62, 0.32, 80)!;
    const shrunkFF = shrink(0.3, 90, 0.32, 80)!;
    expect(proj.xwoba).toBeCloseTo(0.59 * shrunkFF + 0.41 * shrunkST, 5);
    expect(comparisonPa).toBe(152);
    expect(confidence).toBe("Large sample");
  });

  it("labels Low confidence when comparison PA < 25", () => {
    const vsType = new Map<string, PitchRates>([["FF", rates({ xwoba: 0.5, pa: 12 })]]);
    const { mix } = buildPitcherMix({ FF: 100 }, new Map());
    const { confidence, comparisonPa } = projectBatter({
      mix,
      otherTypes: [],
      batterVsType: vsType,
      vsHand,
    });
    expect(comparisonPa).toBe(12);
    expect(confidence).toBe("Low confidence");
  });
});

describe("edges and chips", () => {
  it("dampens league edges by 0.5 and uses Savant point/pp units", () => {
    const edges = edgesFromProj(
      { xwoba: 0.36, xba: 0.27, xslg: 0.5, whiff: 32, barrel: 14 },
      league,
    );
    expect(PITCHER_QUALITY_DAMPENER).toBe(0.5);
    expect(edges.hitsXwobaPoints).toBeCloseTo(0.5 * (0.36 - 0.32) * 1000); // +20
    expect(edges.kWhiffPp).toBeCloseTo(0.5 * (32 - 24)); // +4
    expect(edges.hrBarrelPp).toBeCloseTo(0.5 * (14 - 8)); // +3
    expect(edges.hrXslgPoints).toBeCloseTo(0.5 * (0.5 - 0.42) * 1000); // +40
    expect(chipsForEdges(edges).sort()).toEqual(["HR", "Hits", "K"]);
  });

  it("fires Fade at -20 dampened xwOBA points, not Hits", () => {
    const edges = edgesFromProj(
      { xwoba: 0.28, xba: 0.22, xslg: 0.36, whiff: 24, barrel: 8 },
      league,
    );
    expect(edges.hitsXwobaPoints).toBeCloseTo(-20);
    expect(chipsForEdges(edges)).toEqual(["Fade"]);
  });

  it("does not use BA/SLG thresholds — only expected stats", () => {
    expect(CHIP_THRESHOLDS.hitsXwobaPoints).toBe(20);
    expect(CHIP_THRESHOLDS.hrXslgPoints).toBe(40);
    expect(CHIP_THRESHOLDS.kWhiffPp).toBe(4);
  });
});

describe("chip ranking", () => {
  it("never lets a low-confidence row outrank a large-sample row", () => {
    const chips = pickGameChips(
      [
        {
          playerId: 1,
          name: "Tiny Sample",
          confidence: "Low confidence",
          chips: ["Hits"],
          edges: {
            hitsXwobaPoints: 80,
            kWhiffPp: 0,
            hrBarrelPp: 0,
            hrXslgPoints: 0,
          },
        },
        {
          playerId: 2,
          name: "Large Sample",
          confidence: "Large sample",
          chips: ["Hits"],
          edges: {
            hitsXwobaPoints: 21,
            kWhiffPp: 0,
            hrBarrelPp: 0,
            hrXslgPoints: 0,
          },
        },
      ],
      1,
    );
    expect(chips).toHaveLength(1);
    expect(chips[0]!.name).toBe("Large Sample");
    expect(chipStrength("Hits", { hitsXwobaPoints: 80, kWhiffPp: 0, hrBarrelPp: 0, hrXslgPoints: 0 })).toBeGreaterThan(
      1,
    );
  });

  it("caps at 3 chips", () => {
    const rows = [1, 2, 3, 4].map((i) => ({
      playerId: i,
      name: `P${i}`,
      confidence: "Large sample" as const,
      chips: ["Hits" as const],
      edges: { hitsXwobaPoints: 20 + i, kWhiffPp: 0, hrBarrelPp: 0, hrXslgPoints: 0 },
    }));
    expect(pickGameChips(rows)).toHaveLength(3);
  });
});

describe("helpers", () => {
  it("stands switch-hitters opposite the pitcher", () => {
    expect(standVsPitcher("S", "R")).toBe("L");
    expect(standVsPitcher("S", "L")).toBe("R");
    expect(standVsPitcher("R", "L")).toBe("R");
  });

  it("sums comparison PA across mix types including Other parts", () => {
    const mix = buildPitcherMix({ FF: 90, KN: 10 }, new Map()).mix;
    const vs = new Map<string, PitchRates>([
      ["FF", rates({ pa: 40 })],
      ["KN", rates({ pa: 5 })],
    ]);
    expect(comparisonPaForMix(mix, vs, ["KN"])).toBe(45);
  });
});
