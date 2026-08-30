import {
  BREAKING_TYPES,
  CHIP_THRESHOLDS,
  CORE_PITCH_TYPES,
  LOW_CONFIDENCE_PA,
  MAX_CHIPS_PER_GAME,
  OTHER_USAGE_THRESHOLD,
  PITCHER_QUALITY_DAMPENER,
  PRIORS,
} from "./constants";
import type {
  BatterRow,
  Chip,
  ChipKind,
  Confidence,
  Hand,
  LeagueBaseline,
  PitchMixEntry,
  PitchRates,
  VsHandMeans,
} from "./types";

export function toUsageShare(raw: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  let sum = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (!Number.isFinite(v) || v <= 0) continue;
    out[k] = v;
    sum += v;
  }
  if (sum <= 0) return {};
  const looksLikePercent = sum > 1.5;
  if (looksLikePercent) {
    for (const k of Object.keys(out)) out[k] = out[k] / 100;
    sum = sum / 100;
  }
  if (Math.abs(sum - 1) > 0.02) {
    for (const k of Object.keys(out)) out[k] = out[k] / sum;
  }
  return out;
}

export function rollupMix(usage: Record<string, number>): {
  kept: Record<string, number>;
  other: number;
  otherTypes: string[];
} {
  const shares = toUsageShare(usage);
  const kept: Record<string, number> = {};
  let other = 0;
  const otherTypes: string[] = [];
  for (const [type, share] of Object.entries(shares)) {
    const isCore = (CORE_PITCH_TYPES as readonly string[]).includes(type);
    if (!isCore || share < OTHER_USAGE_THRESHOLD) {
      other += share;
      otherTypes.push(type);
    } else {
      kept[type] = share;
    }
  }
  return { kept, other, otherTypes };
}

export function shrink(
  rate: number | null,
  pa: number,
  priorMean: number | null,
  priorPa: number,
): number | null {
  if (priorMean == null && rate == null) return null;
  if (rate == null) return priorMean;
  if (priorMean == null) return rate;
  const n = Math.max(0, pa);
  return (n * rate + priorPa * priorMean) / (n + priorPa);
}

export function combineRates(parts: { rates: PitchRates; weight: number }[]): PitchRates {
  let w = 0;
  const acc = emptyRates();
  const sums = {
    xwoba: 0,
    xba: 0,
    xslg: 0,
    whiff: 0,
    barrel: 0,
    hardHit: 0,
    rv100: 0,
  };
  const has = {
    xwoba: 0,
    xba: 0,
    xslg: 0,
    whiff: 0,
    barrel: 0,
    hardHit: 0,
    rv100: 0,
  };
  let pa = 0;
  let pitches = 0;
  for (const { rates, weight } of parts) {
    if (weight <= 0) continue;
    w += weight;
    pa += rates.pa;
    pitches += rates.pitches;
    add(sums, has, "xwoba", rates.xwoba, weight);
    add(sums, has, "xba", rates.xba, weight);
    add(sums, has, "xslg", rates.xslg, weight);
    add(sums, has, "whiff", rates.whiff, weight);
    add(sums, has, "barrel", rates.barrel, weight);
    add(sums, has, "hardHit", rates.hardHit, weight);
    add(sums, has, "rv100", rates.rv100, weight);
  }
  if (w <= 0) return acc;
  acc.xwoba = has.xwoba ? sums.xwoba / has.xwoba : null;
  acc.xba = has.xba ? sums.xba / has.xba : null;
  acc.xslg = has.xslg ? sums.xslg / has.xslg : null;
  acc.whiff = has.whiff ? sums.whiff / has.whiff : null;
  acc.barrel = has.barrel ? sums.barrel / has.barrel : null;
  acc.hardHit = has.hardHit ? sums.hardHit / has.hardHit : null;
  acc.rv100 = has.rv100 ? sums.rv100 / has.rv100 : null;
  acc.pa = pa;
  acc.pitches = pitches;
  return acc;
}

function add(
  sums: Record<string, number>,
  has: Record<string, number>,
  key: string,
  value: number | null,
  weight: number,
) {
  if (value == null || !Number.isFinite(value)) return;
  sums[key] += value * weight;
  has[key] += weight;
}

export function emptyRates(): PitchRates {
  return {
    xwoba: null,
    xba: null,
    xslg: null,
    whiff: null,
    barrel: null,
    hardHit: null,
    rv100: null,
    pa: 0,
    pitches: 0,
  };
}

export function mergeSeasonRates(a: PitchRates | undefined, b: PitchRates | undefined): PitchRates {
  if (!a) return b ? { ...b } : emptyRates();
  if (!b) return { ...a };
  const pa = a.pa + b.pa;
  const pitches = a.pitches + b.pitches;
  const wA = a.pa > 0 ? a.pa : a.pitches;
  const wB = b.pa > 0 ? b.pa : b.pitches;
  return combineRates([
    { rates: a, weight: wA || 1 },
    { rates: b, weight: wB || 1 },
  ]);
}

export function buildPitcherMix(
  usageRaw: Record<string, number>,
  vsType: Map<string, PitchRates> | undefined,
): { mix: PitchMixEntry[]; otherUsage: number; otherTypes: string[]; mixQualityXwoba: number | null } {
  const { kept, other, otherTypes } = rollupMix(usageRaw);
  const mix: PitchMixEntry[] = [];
  const qualityParts: { rates: PitchRates; weight: number }[] = [];

  for (const [type, usage] of Object.entries(kept)) {
    const rates = vsType?.get(type) ?? emptyRates();
    mix.push({ type, usage, rolledIntoOther: false, ...rates });
    qualityParts.push({ rates, weight: usage });
  }

  if (other > 0.005) {
    const otherParts = otherTypes.map((t) => ({
      rates: vsType?.get(t) ?? emptyRates(),
      weight: (toUsageShare(usageRaw)[t] ?? 0) || 1,
    }));
    const otherRates = combineRates(otherParts);
    mix.push({ type: "OTHER", usage: other, rolledIntoOther: true, ...otherRates });
    qualityParts.push({ rates: otherRates, weight: other });
  }

  mix.sort((a, b) => b.usage - a.usage);
  const quality = combineRates(qualityParts);
  return { mix, otherUsage: other, otherTypes, mixQualityXwoba: quality.xwoba };
}

export function comparisonPaForMix(
  mix: PitchMixEntry[],
  batterVsType: Map<string, PitchRates> | undefined,
  otherTypes: string[],
): number {
  let pa = 0;
  for (const entry of mix) {
    if (entry.type === "OTHER") {
      for (const t of otherTypes) pa += batterVsType?.get(t)?.pa ?? 0;
    } else {
      pa += batterVsType?.get(entry.type)?.pa ?? 0;
    }
  }
  return pa;
}

export function projectBatter(args: {
  mix: PitchMixEntry[];
  otherTypes: string[];
  batterVsType: Map<string, PitchRates> | undefined;
  vsHand: VsHandMeans | undefined;
}): {
  proj: BatterRow["proj"];
  comparisonPa: number;
  confidence: Confidence;
  missingReason: string | null;
} {
  const { mix, otherTypes, batterVsType, vsHand } = args;
  if (!mix.length) {
    return {
      proj: { xwoba: null, xba: null, xslg: null, whiff: null, barrel: null },
      comparisonPa: 0,
      confidence: "Low confidence",
      missingReason: "No pitcher mix to project against.",
    };
  }
  if (!batterVsType && !vsHand) {
    return {
      proj: { xwoba: null, xba: null, xslg: null, whiff: null, barrel: null },
      comparisonPa: 0,
      confidence: "Low confidence",
      missingReason: "No Savant vs-pitch-type or vs-hand sample for this batter.",
    };
  }

  const comparisonPa = comparisonPaForMix(mix, batterVsType, otherTypes);
  const confidence: Confidence = comparisonPa < LOW_CONFIDENCE_PA ? "Low confidence" : "Large sample";

  const proj = {
    xwoba: projectMetric(mix, batterVsType, otherTypes, vsHand, "xwoba", PRIORS.xwoba),
    xba: projectMetric(mix, batterVsType, otherTypes, vsHand, "xba", PRIORS.xba),
    xslg: projectMetric(mix, batterVsType, otherTypes, vsHand, "xslg", PRIORS.xslg),
    whiff: projectMetric(mix, batterVsType, otherTypes, vsHand, "whiff", PRIORS.whiff),
    barrel: projectMetric(mix, batterVsType, otherTypes, vsHand, "barrel", PRIORS.barrel),
  };

  const missingReason =
    proj.xwoba == null && proj.whiff == null
      ? "Savant returned no usable expected-stat split for this batter."
      : null;

  return { proj, comparisonPa, confidence, missingReason };
}

function projectMetric(
  mix: PitchMixEntry[],
  batterVsType: Map<string, PitchRates> | undefined,
  otherTypes: string[],
  vsHand: VsHandMeans | undefined,
  key: keyof Pick<PitchRates, "xwoba" | "xba" | "xslg" | "whiff" | "barrel">,
  priorPa: number,
): number | null {
  const prior = vsHand?.[key] ?? null;
  let num = 0;
  let den = 0;
  for (const entry of mix) {
    let rate: number | null = null;
    let pa = 0;
    if (entry.type === "OTHER") {
      const parts = otherTypes
        .map((t) => batterVsType?.get(t))
        .filter((r): r is PitchRates => !!r);
      if (parts.length) {
        const combined = combineRates(parts.map((r) => ({ rates: r, weight: r.pa || r.pitches || 1 })));
        rate = combined[key];
        pa = combined.pa;
      }
    } else {
      const row = batterVsType?.get(entry.type);
      rate = row?.[key] ?? null;
      pa = row?.pa ?? 0;
    }
    const shrunk = shrink(rate, pa, prior, priorPa);
    if (shrunk == null) continue;
    num += entry.usage * shrunk;
    den += entry.usage;
  }
  if (den <= 0) return prior;
  return num / den;
}

export function edgesFromProj(
  proj: BatterRow["proj"],
  league: LeagueBaseline,
): BatterRow["edges"] {
  const d = PITCHER_QUALITY_DAMPENER;
  return {
    hitsXwobaPoints:
      proj.xwoba == null ? null : d * (proj.xwoba - league.xwoba) * 1000,
    kWhiffPp: proj.whiff == null ? null : d * (proj.whiff - league.whiff),
    hrBarrelPp:
      proj.barrel == null || league.barrel == null
        ? null
        : d * (proj.barrel - league.barrel),
    hrXslgPoints: proj.xslg == null ? null : d * (proj.xslg - league.xslg) * 1000,
  };
}

export function chipsForEdges(edges: BatterRow["edges"]): ChipKind[] {
  const out: ChipKind[] = [];
  if (edges.hitsXwobaPoints != null && gte(edges.hitsXwobaPoints, CHIP_THRESHOLDS.hitsXwobaPoints)) {
    out.push("Hits");
  }
  const hrBarrel = edges.hrBarrelPp != null && gte(edges.hrBarrelPp, CHIP_THRESHOLDS.hrBarrelPp);
  const hrXslg = edges.hrXslgPoints != null && gte(edges.hrXslgPoints, CHIP_THRESHOLDS.hrXslgPoints);
  if (hrBarrel || hrXslg) out.push("HR");
  if (edges.kWhiffPp != null && gte(edges.kWhiffPp, CHIP_THRESHOLDS.kWhiffPp)) {
    out.push("K");
  }
  if (edges.hitsXwobaPoints != null && lte(edges.hitsXwobaPoints, CHIP_THRESHOLDS.fadeXwobaPoints)) {
    out.push("Fade");
  }
  return out;
}

function gte(value: number, bar: number): boolean {
  return value + 1e-9 >= bar;
}

function lte(value: number, bar: number): boolean {
  return value <= bar + 1e-9;
}

export function chipStrength(kind: ChipKind, edges: BatterRow["edges"]): number {
  const t = CHIP_THRESHOLDS;
  if (kind === "Hits") return Math.abs(edges.hitsXwobaPoints ?? 0) / t.hitsXwobaPoints;
  if (kind === "Fade") return Math.abs(edges.hitsXwobaPoints ?? 0) / t.hitsXwobaPoints;
  if (kind === "K") return Math.abs(edges.kWhiffPp ?? 0) / t.kWhiffPp;
  const barrel = edges.hrBarrelPp != null ? edges.hrBarrelPp / t.hrBarrelPp : 0;
  const xslg = edges.hrXslgPoints != null ? edges.hrXslgPoints / t.hrXslgPoints : 0;
  return Math.max(barrel, xslg);
}

export function chipDetail(kind: ChipKind, edges: BatterRow["edges"]): string {
  if (kind === "Hits" || kind === "Fade") {
    const v = edges.hitsXwobaPoints;
    return v == null ? "xwOBA edge unavailable" : `${fmtSigned(v, 0)} xwOBA pts`;
  }
  if (kind === "K") {
    const v = edges.kWhiffPp;
    return v == null ? "Whiff edge unavailable" : `${fmtSigned(v, 1)} whiff pp`;
  }
  const parts: string[] = [];
  if (edges.hrBarrelPp != null) parts.push(`${fmtSigned(edges.hrBarrelPp, 1)} barrel pp`);
  if (edges.hrXslgPoints != null) parts.push(`${fmtSigned(edges.hrXslgPoints, 0)} xSLG pts`);
  return parts.join(" / ") || "HR edge unavailable";
}

export function pickGameChips(
  rows: { playerId: number; name: string; confidence: Confidence; chips: ChipKind[]; edges: BatterRow["edges"] }[],
  limit = MAX_CHIPS_PER_GAME,
): Chip[] {
  const candidates: Chip[] = [];
  for (const row of rows) {
    for (const kind of row.chips) {
      candidates.push({
        kind,
        playerId: row.playerId,
        name: row.name,
        strength: chipStrength(kind, row.edges),
        lowConfidence: row.confidence === "Low confidence",
        detail: chipDetail(kind, row.edges),
      });
    }
  }
  candidates.sort((a, b) => {
    if (a.lowConfidence !== b.lowConfidence) return a.lowConfidence ? 1 : -1;
    return b.strength - a.strength;
  });
  return candidates.slice(0, limit);
}

export function standVsPitcher(batSide: Hand | "S" | null, pitchHand: Hand | null): Hand | null {
  if (!pitchHand) return batSide === "S" ? null : batSide;
  if (batSide === "S") return pitchHand === "R" ? "L" : "R";
  return batSide;
}

export function breakingBallShare(mix: PitchMixEntry[]): number {
  return mix
    .filter((m) => m.type !== "OTHER" && BREAKING_TYPES.has(m.type))
    .reduce((s, m) => s + m.usage, 0);
}

function fmtSigned(n: number, digits: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}`;
}

export function emptyVsHand(): VsHandMeans {
  return emptyRates();
}
