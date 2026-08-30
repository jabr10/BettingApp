import {
  BATTER_POOL_SEASONS,
  MIX_SEASON,
  SAVANT_BASE,
  SAVANT_CACHE_MS,
} from "./constants";
import { cacheGet, cacheGetStale, cacheSet } from "./cache";
import { int, num, parseCsv } from "./csv";
import { fetchText } from "./http";
import { combineRates, emptyRates, mergeSeasonRates } from "./scoring";
import type { DataWarning, Hand, LeagueBaseline, PitchRates, SavantStore, VsHandMeans } from "./types";

type SerializedStore = {
  fetchedAt: string;
  pitcherUsage: [number, Record<string, number>][];
  pitcherVsType: [number, [string, PitchRates][]][];
  batterVsType: [number, [string, PitchRates][]][];
  batterVsHand: [string, VsHandMeans][];
  league: Record<Hand, LeagueBaseline>;
  warnings: DataWarning[];
};

const STORE_KEY = `savant-store-v1-${MIX_SEASON}-${BATTER_POOL_SEASONS.join("_")}`;

export async function loadSavantStore(): Promise<SavantStore> {
  const cached = await cacheGet<SerializedStore>(STORE_KEY, SAVANT_CACHE_MS);
  if (cached) return deserialize(cached);

  try {
    const store = await fetchSavantStore();
    await cacheSet(STORE_KEY, serialize(store), SAVANT_CACHE_MS);
    return store;
  } catch (err) {
    const stale = await cacheGetStale<SerializedStore>(STORE_KEY);
    if (stale) {
      const store = deserialize(stale.value);
      store.warnings = [
        ...store.warnings,
        {
          source: "savant",
          message: `Using stale Savant cache from ${new Date(stale.storedAt).toISOString()}. Refresh failed: ${errMsg(err)}`,
        },
      ];
      return store;
    }
    throw err;
  }
}

async function fetchSavantStore(): Promise<SavantStore> {
  const warnings: DataWarning[] = [];
  const pitcherUsage = new Map<number, Record<string, number>>();
  const pitcherVsType = new Map<number, Map<string, PitchRates>>();
  const batterVsType = new Map<number, Map<string, PitchRates>>();
  const batterVsHand = new Map<string, VsHandMeans>();

  const usageRows = await safeCsv(
    arsenalUsageUrl(MIX_SEASON),
    "pitch-arsenals usage 2026",
    warnings,
  );
  for (const row of usageRows) {
    const id = int(row.pitcher || row.player_id);
    if (!id) continue;
    const usage: Record<string, number> = {};
    for (const [key, value] of Object.entries(row)) {
      const m = key.match(/^n_([a-z0-9]+)$/i);
      if (!m) continue;
      const n = num(value);
      if (n != null && n > 0) usage[m[1]!.toUpperCase()] = n;
    }
    if (Object.keys(usage).length) pitcherUsage.set(id, usage);
  }

  const pitcherStatRows = await safeCsv(
    arsenalStatsUrl("pitcher", MIX_SEASON),
    "pitch-arsenal-stats pitchers 2026",
    warnings,
  );
  for (const row of pitcherStatRows) {
    const parsed = parseArsenalRow(row);
    if (!parsed) continue;
    const { playerId, pitchType, rates, usagePct } = parsed;
    if (!pitcherVsType.has(playerId)) pitcherVsType.set(playerId, new Map());
    pitcherVsType.get(playerId)!.set(pitchType, rates);
    if (usagePct != null && usagePct > 0) {
      const cur = pitcherUsage.get(playerId) ?? {};
      if (cur[pitchType] == null) cur[pitchType] = usagePct;
      pitcherUsage.set(playerId, cur);
    }
  }

  for (const year of BATTER_POOL_SEASONS) {
    const rows = await safeCsv(
      arsenalStatsUrl("batter", year),
      `pitch-arsenal-stats batters ${year}`,
      warnings,
    );
    for (const row of rows) {
      const parsed = parseArsenalRow(row);
      if (!parsed) continue;
      const { playerId, pitchType, rates } = parsed;
      if (!batterVsType.has(playerId)) batterVsType.set(playerId, new Map());
      const map = batterVsType.get(playerId)!;
      map.set(pitchType, mergeSeasonRates(map.get(pitchType), rates));
    }
  }

  for (const hand of ["L", "R"] as const) {
    const rows = await safeCsv(
      vsHandSearchUrl(hand),
      `statcast search batters vs ${hand}HP 2025-2026`,
      warnings,
    );
    for (const row of rows) {
      const id = int(row.player_id);
      if (!id) continue;
      batterVsHand.set(`${id}-${hand}`, searchRowToRates(row));
    }
  }

  await attachBatterBarrels(batterVsType, warnings);

  const league = {
    L: leagueFromVsHand(batterVsHand, "L"),
    R: leagueFromVsHand(batterVsHand, "R"),
  };

  return {
    fetchedAt: new Date().toISOString(),
    pitcherUsage,
    pitcherVsType,
    batterVsType,
    batterVsHand,
    league,
    warnings,
  };
}

async function attachBatterBarrels(
  batterVsType: Map<number, Map<string, PitchRates>>,
  warnings: DataWarning[],
) {
  const types = ["FF", "SI", "FC", "SL", "ST", "SV", "CU", "KC", "CH", "FS"];
  for (const type of types) {
    const rows = await safeCsv(
      pitchTypeSearchUrl(type),
      `statcast search batters vs ${type} 2025-2026 (barrel)`,
      warnings,
    );
    for (const row of rows) {
      const id = int(row.player_id);
      if (!id) continue;
      const barrel = num(row.barrels_per_bbe_percent);
      if (barrel == null) continue;
      if (!batterVsType.has(id)) batterVsType.set(id, new Map());
      const map = batterVsType.get(id)!;
      const cur = map.get(type) ?? emptyRates();
      if (cur.pa === 0) {
        map.set(type, { ...searchRowToRates(row), barrel });
      } else {
        map.set(type, { ...cur, barrel });
      }
    }
  }
}

function parseArsenalRow(row: Record<string, string>): {
  playerId: number;
  pitchType: string;
  rates: PitchRates;
  usagePct: number | null;
} | null {
  const playerId = int(row.player_id);
  const pitchType = (row.pitch_type || "").trim().toUpperCase();
  if (!playerId || !pitchType) return null;
  return {
    playerId,
    pitchType,
    usagePct: num(row.pitch_usage),
    rates: {
      xwoba: num(row.est_woba),
      xba: num(row.est_ba),
      xslg: num(row.est_slg),
      whiff: num(row.whiff_percent),
      barrel: null,
      hardHit: num(row.hard_hit_percent),
      rv100: num(row.run_value_per_100),
      pa: int(row.pa),
      pitches: int(row.pitches),
    },
  };
}

function searchRowToRates(row: Record<string, string>): PitchRates {
  const whiff = num(row.swing_miss_percent);
  const whiffs = num(row.whiffs);
  const swings = num(row.swings);
  const whiffFromCounts =
    whiff != null ? whiff : whiffs != null && swings && swings > 0 ? (whiffs / swings) * 100 : null;
  return {
    xwoba: num(row.xwoba),
    xba: num(row.xba),
    xslg: num(row.xslg),
    whiff: whiffFromCounts,
    barrel: num(row.barrels_per_bbe_percent),
    hardHit: num(row.hardhit_percent),
    rv100: num(row.batter_run_value_per_100),
    pa: int(row.pa),
    pitches: int(row.pitches),
  };
}

function leagueFromVsHand(map: Map<string, VsHandMeans>, hand: Hand): LeagueBaseline {
  const parts: { rates: PitchRates; weight: number }[] = [];
  for (const [key, rates] of map) {
    if (!key.endsWith(`-${hand}`)) continue;
    parts.push({ rates, weight: rates.pa || rates.pitches || 1 });
  }
  const combined = combineRates(parts);
  return {
    hand,
    xwoba: combined.xwoba ?? 0.32,
    xba: combined.xba ?? 0.25,
    xslg: combined.xslg ?? 0.41,
    whiff: combined.whiff ?? 24,
    barrel: combined.barrel,
    pa: combined.pa,
  };
}

function arsenalUsageUrl(year: number): string {
  return `${SAVANT_BASE}/leaderboard/pitch-arsenals?year=${year}&min=1&type=n_&hand=&csv=true`;
}

function arsenalStatsUrl(playerType: "pitcher" | "batter", year: number): string {
  return `${SAVANT_BASE}/leaderboard/pitch-arsenal-stats?type=${playerType}&pitchType=&year=${year}&team=&min=1&csv=true`;
}

function vsHandSearchUrl(hand: Hand): string {
  const sea = BATTER_POOL_SEASONS.map((y) => `${y}`).join("%7C") + "%7C";
  return `${SAVANT_BASE}/statcast_search/csv?all=true&hfPT=&hfAB=&hfGT=R%7C&hfSea=${sea}&player_type=batter&pitcher_throws=${hand}&min_abs=1&group_by=name&sort_col=pitches&sort_order=desc&min_pitches=0&min_results=0`;
}

function pitchTypeSearchUrl(type: string): string {
  const sea = BATTER_POOL_SEASONS.map((y) => `${y}`).join("%7C") + "%7C";
  return `${SAVANT_BASE}/statcast_search/csv?all=true&hfPT=${type}%7C&hfAB=&hfGT=R%7C&hfSea=${sea}&player_type=batter&min_abs=1&group_by=name&sort_col=pitches&sort_order=desc&min_pitches=0&min_results=0`;
}

async function safeCsv(url: string, label: string, warnings: DataWarning[]): Promise<Record<string, string>[]> {
  try {
    const text = await fetchText(url, { timeoutMs: 60_000, retries: 2 });
    return parseCsv(text);
  } catch (err) {
    warnings.push({
      source: "savant",
      message: `Could not load ${label}: ${errMsg(err)}. Matching rows that need this file will be empty — no numbers were invented.`,
    });
    return [];
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function serialize(store: SavantStore): SerializedStore {
  return {
    fetchedAt: store.fetchedAt,
    pitcherUsage: [...store.pitcherUsage.entries()],
    pitcherVsType: [...store.pitcherVsType.entries()].map(([id, m]) => [id, [...m.entries()]]),
    batterVsType: [...store.batterVsType.entries()].map(([id, m]) => [id, [...m.entries()]]),
    batterVsHand: [...store.batterVsHand.entries()],
    league: store.league,
    warnings: store.warnings,
  };
}

function deserialize(raw: SerializedStore): SavantStore {
  return {
    fetchedAt: raw.fetchedAt,
    pitcherUsage: new Map(raw.pitcherUsage),
    pitcherVsType: new Map(raw.pitcherVsType.map(([id, entries]) => [id, new Map(entries)])),
    batterVsType: new Map(raw.batterVsType.map(([id, entries]) => [id, new Map(entries)])),
    batterVsHand: new Map(raw.batterVsHand),
    league: raw.league,
    warnings: raw.warnings,
  };
}

export function savantUrlsForReadme(): string[] {
  return [
    arsenalUsageUrl(MIX_SEASON),
    arsenalStatsUrl("pitcher", MIX_SEASON),
    ...BATTER_POOL_SEASONS.map((y) => arsenalStatsUrl("batter", y)),
    vsHandSearchUrl("L"),
    vsHandSearchUrl("R"),
  ];
}
