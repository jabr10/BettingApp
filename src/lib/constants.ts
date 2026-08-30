export const CORE_PITCH_TYPES = [
  "FF",
  "SI",
  "FC",
  "SL",
  "ST",
  "SV",
  "CU",
  "KC",
  "CH",
  "FS",
] as const;

export type CorePitchType = (typeof CORE_PITCH_TYPES)[number];

export const PITCH_NAMES: Record<string, string> = {
  FF: "4-Seam",
  SI: "Sinker",
  FC: "Cutter",
  SL: "Slider",
  ST: "Sweeper",
  SV: "Slurve",
  CU: "Curve",
  KC: "Knuckle-curve",
  CH: "Change",
  FS: "Splitter",
  KN: "Knuckleball",
  OTHER: "Other",
};

export const BREAKING_TYPES = new Set(["SL", "ST", "SV", "CU", "KC"]);

/** Types under this usage share roll into Other. */
export const OTHER_USAGE_THRESHOLD = 0.08;

/** Empirical-Bayes priors (PA) toward the batter's vs-that-hand mean. */
export const PRIORS = {
  xwoba: 80,
  xba: 80,
  xslg: 80,
  whiff: 60,
  barrel: 100,
} as const;

/** Comparison PA below this is Low confidence. */
export const LOW_CONFIDENCE_PA = 25;

/**
 * Chip thresholds, applied to dampened edges.
 * xwOBA / xSLG are Savant thousandths ("points"): +20 xwOBA = +0.020.
 * Whiff and barrel are percentage points on Savant's % scale.
 */
export const CHIP_THRESHOLDS = {
  hitsXwobaPoints: 20,
  hrBarrelPp: 2,
  hrXslgPoints: 40,
  kWhiffPp: 4,
  fadeXwobaPoints: -20,
} as const;

/** Flat pitcher-mix quality dampener. Not fitted to betting results. */
export const PITCHER_QUALITY_DAMPENER = 0.5;

export const MAX_CHIPS_PER_GAME = 3;

export const TIMEZONE = "America/New_York";
export const MIX_SEASON = 2026;
export const BATTER_POOL_SEASONS = [2025, 2026] as const;

export const SLATE_CACHE_MS = 10 * 60 * 1000;
export const LINEUP_CACHE_MS = 30 * 60 * 1000;
export const SAVANT_CACHE_MS = 20 * 60 * 60 * 1000;
export const PEOPLE_CACHE_MS = 20 * 60 * 60 * 1000;

export const USER_AGENT =
  "MatchupResearch/1.0 (research tool; not a sportsbook; github.com/jabr10/BettingApp)";

export const SAVANT_BASE = "https://baseballsavant.mlb.com";
export const STATS_API_BASE = "https://statsapi.mlb.com/api/v1";
