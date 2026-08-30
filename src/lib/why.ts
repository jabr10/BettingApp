import { BREAKING_TYPES, PITCH_NAMES } from "./constants";
import { breakingBallShare } from "./scoring";
import type { PitchMixEntry, PitchRates, VsHandMeans } from "./types";

export function buildWhy(args: {
  mix: PitchMixEntry[];
  otherTypes: string[];
  batterVsType: Map<string, PitchRates> | undefined;
  vsHand: VsHandMeans | undefined;
  pitcherName: string | null;
  hitsEdge?: number | null;
}): string {
  const { mix, batterVsType, vsHand, pitcherName, hitsEdge } = args;
  if (!mix.length) return "No starter mix on file, so there is no vs-type projection.";
  if (!batterVsType || batterVsType.size === 0) {
    return "No Savant vs-pitch-type sample for this batter in the 2025–2026 pool.";
  }

  const named = mix.filter((m) => m.type !== "OTHER");
  const scored = named
    .map((m) => {
      const row = batterVsType.get(m.type);
      const xwoba = row?.xwoba ?? null;
      const vs = vsHand?.xwoba ?? null;
      const delta = xwoba != null && vs != null ? xwoba - vs : xwoba;
      return {
        type: m.type,
        usage: m.usage,
        pa: row?.pa ?? 0,
        xwoba,
        delta: delta ?? 0,
        has: row != null && row.xwoba != null,
      };
    })
    .filter((s) => s.has);

  if (!scored.length) {
    return "Mix types are posted, but this batter has no overlapping vs-type expected stats.";
  }

  scored.sort((a, b) => b.delta - a.delta);
  const crush = scored.filter((s) => s.delta >= 0.03 && s.pa >= 10).slice(0, 2);
  const weak = [...scored].sort((a, b) => a.delta - b.delta).filter((s) => s.delta <= -0.03 && s.pa >= 10);

  const he = pronoun(pitcherName);
  const bb = breakingBallShare(mix);
  const top = named[0];
  const usageClause = bb >= 0.32
    ? `${he} is ${pct(bb)} breaking balls`
    : top
      ? `${he} is ${pct(top.usage)} ${label(top.type)}`
      : `${he} mix is thin`;

  const fade = hitsEdge != null && hitsEdge <= -20;
  const hot = hitsEdge != null && hitsEdge >= 20;
  if (fade && weak.length) {
    const feature = weak[0];
    return `Soft vs ${feature.type}; ${usageClause}; ${feature.pa} PA vs ${feature.type}.`;
  }
  if ((hot || !fade) && crush.length) {
    const types = crush.map((c) => c.type).join("/");
    const feature = crush[0];
    return `Crushes ${types}; ${usageClause}; ${feature.pa} PA vs ${feature.type}.`;
  }
  if (weak.length) {
    const feature = weak[0];
    return `Soft vs ${feature.type}; ${usageClause}; ${feature.pa} PA vs ${feature.type}.`;
  }

  const feature = [...scored].sort((a, b) => b.pa - a.pa)[0];
  return `Neutral vs his ${named.slice(0, 2).map((m) => m.type).join("/")}; ${usageClause}; ${feature.pa} PA vs ${feature.type}.`;
}

function pronoun(name: string | null): string {
  return name ? `${lastName(name)}` : "he";
}

function lastName(name: string): string {
  if (name.includes(",")) return name.split(",")[0]!.trim();
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function label(type: string): string {
  return PITCH_NAMES[type] ?? type;
}

export function topPitchLabels(mix: { type: string; usage: number }[], n = 3): string {
  return mix
    .filter((m) => m.type !== "OTHER")
    .slice(0, n)
    .map((m) => `${m.type} ${Math.round(m.usage * 100)}%`)
    .join(" · ");
}

export { BREAKING_TYPES };
