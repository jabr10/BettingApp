import { SLATE_CACHE_MS, TIMEZONE } from "./constants";
import { cacheGet, cacheSet } from "./cache";
import { addDays, formatEtTime, todayEt } from "./dates";
import {
  fetchPeople,
  fetchRecentSchedule,
  fetchSchedule,
  officialLineup,
  pastGamesForTeam,
  projectLineup,
  type ScheduleGame,
} from "./mlb";
import { buildPitcherMix, chipsForEdges, edgesFromProj, pickGameChips, projectBatter, standVsPitcher } from "./scoring";
import { loadSavantStore } from "./savant";
import { buildWhy, topPitchLabels } from "./why";
import type {
  BatterRow,
  Chip,
  DataWarning,
  GameCard,
  Hand,
  LineupState,
  OfficialLineupPlayer,
  Person,
  SavantStore,
  Slate,
  StarterCard,
  TeamSide,
} from "./types";

export async function loadSlate(date = todayEt()): Promise<Slate> {
  const key = `slate-${date}`;
  const cached = await cacheGet<Slate>(key, SLATE_CACHE_MS);
  if (cached) return cached;

  const warnings: DataWarning[] = [];
  let gamesRaw: ScheduleGame[] = [];
  try {
    gamesRaw = await fetchSchedule(date);
  } catch (err) {
    warnings.push({
      source: "statsapi",
      message: `Could not load today's MLB schedule: ${err instanceof Error ? err.message : String(err)}.`,
    });
    return {
      dateEt: date,
      timezone: TIMEZONE,
      games: [],
      warnings,
      cache: { savantAsOf: null, slateAsOf: new Date().toISOString() },
    };
  }

  let store: SavantStore;
  try {
    store = await loadSavantStore();
    warnings.push(...store.warnings);
  } catch (err) {
    warnings.push({
      source: "savant",
      message: `Savant leaderboards failed: ${err instanceof Error ? err.message : String(err)}. No matchup numbers were invented.`,
    });
    const empty = await buildSlateWithoutSavant(date, gamesRaw, warnings);
    await cacheSet(key, empty, SLATE_CACHE_MS);
    return empty;
  }

  let recent: ScheduleGame[] = [];
  try {
    recent = await fetchRecentSchedule(addDays(date, -60), addDays(date, -1));
  } catch (err) {
    warnings.push({
      source: "statsapi",
      message: `Could not load recent games for projected lineups: ${err instanceof Error ? err.message : String(err)}.`,
    });
  }

  const peopleIds = collectIds(gamesRaw, recent);
  const people = await fetchPeople(peopleIds);
    const games = gamesRaw.map((g) => buildGame(g, recent, people, store));
  const slate: Slate = {
    dateEt: date,
    timezone: TIMEZONE,
    games,
    warnings,
    cache: { savantAsOf: store.fetchedAt, slateAsOf: new Date().toISOString() },
  };
  await cacheSet(key, slate, SLATE_CACHE_MS);
  return slate;
}

export async function loadGame(gamePk: number, date = todayEt()): Promise<GameCard | null> {
  const slate = await loadSlate(date);
  return slate.games.find((g) => g.gamePk === gamePk) ?? null;
}

async function buildSlateWithoutSavant(
  date: string,
  gamesRaw: ScheduleGame[],
  warnings: DataWarning[],
): Promise<Slate> {
  const people = await fetchPeople(collectIds(gamesRaw, []));
  const games = gamesRaw.map((g) => {
    const emptyStore = {
      fetchedAt: "",
      pitcherUsage: new Map(),
      pitcherVsType: new Map(),
      batterVsType: new Map(),
      batterVsHand: new Map(),
      league: {
        L: { hand: "L" as const, xwoba: 0, xba: 0, xslg: 0, whiff: 0, barrel: null, pa: 0 },
        R: { hand: "R" as const, xwoba: 0, xba: 0, xslg: 0, whiff: 0, barrel: null, pa: 0 },
      },
      warnings: [],
    };
    return buildGame(g, [], people, emptyStore);
  });
  return {
    dateEt: date,
    timezone: TIMEZONE,
    games,
    warnings,
    cache: { savantAsOf: null, slateAsOf: new Date().toISOString() },
  };
}

function collectIds(today: ScheduleGame[], recent: ScheduleGame[]): number[] {
  const ids: number[] = [];
  for (const g of [...today, ...recent]) {
    const hp = g.teams.home.probablePitcher?.id;
    const ap = g.teams.away.probablePitcher?.id;
    if (hp) ids.push(hp);
    if (ap) ids.push(ap);
    for (const p of g.lineups?.homePlayers ?? []) ids.push(p.id);
    for (const p of g.lineups?.awayPlayers ?? []) ids.push(p.id);
  }
  return ids;
}

function buildGame(
  g: ScheduleGame,
  recent: ScheduleGame[],
  people: Map<number, Person>,
  store: SavantStore,
): GameCard {
  const homeStarter = starterCard(g.teams.home.probablePitcher, people, store);
  const awayStarter = starterCard(g.teams.away.probablePitcher, people, store);

  const home = teamSide({
    teamId: g.teams.home.team.id,
    teamName: g.teams.home.team.name,
    abbreviation: g.teams.home.team.abbreviation ?? g.teams.home.team.name,
    official: officialLineup(g.lineups?.homePlayers),
    recent: pastGamesForTeam(recent, g.teams.home.team.id).map((pg) => ({
      ...pg,
      opponentThrows: pg.opponentStarterId
        ? people.get(pg.opponentStarterId)?.pitchHand ?? null
        : null,
    })),
    vsPitcher: awayStarter,
    people,
    store,
  });

  const away = teamSide({
    teamId: g.teams.away.team.id,
    teamName: g.teams.away.team.name,
    abbreviation: g.teams.away.team.abbreviation ?? g.teams.away.team.name,
    official: officialLineup(g.lineups?.awayPlayers),
    recent: pastGamesForTeam(recent, g.teams.away.team.id).map((pg) => ({
      ...pg,
      opponentThrows: pg.opponentStarterId
        ? people.get(pg.opponentStarterId)?.pitchHand ?? null
        : null,
    })),
    vsPitcher: homeStarter,
    people,
    store,
  });

  const chips = pickGameChips(
    [...away.lineup, ...home.lineup].map((r) => ({
      playerId: r.playerId,
      name: r.name,
      confidence: r.confidence,
      chips: r.chips,
      edges: r.edges,
    })),
  );

  const lineupState: GameCard["lineupState"] =
    away.lineupState === home.lineupState ? away.lineupState : "Split";

  return {
    gamePk: g.gamePk,
    gameDateUtc: g.gameDate,
    gameTimeEt: formatEtTime(g.gameDate),
    park: g.venue?.name ?? "Unknown park",
    status: g.status?.detailedState ?? "",
    away: { ...away, starter: awayStarter, chips: chips.filter((c) => away.lineup.some((r) => r.playerId === c.playerId)) },
    home: { ...home, starter: homeStarter, chips: chips.filter((c) => home.lineup.some((r) => r.playerId === c.playerId)) },
    lineupState,
    chips,
    warnings: [],
  };
}

function teamSide(args: {
  teamId: number;
  teamName: string;
  abbreviation: string;
  official: OfficialLineupPlayer[];
  recent: ReturnType<typeof pastGamesForTeam>;
  vsPitcher: StarterCard;
  people: Map<number, Person>;
  store: SavantStore;
}): Omit<TeamSide, "starter" | "chips"> & { chips: Chip[] } {
  let lineupState: LineupState = "Not posted";
  let players: OfficialLineupPlayer[] = [];
  const vsHand = args.vsPitcher.throws;

  if (args.official.length >= 8) {
    lineupState = "Official";
    players = args.official.slice(0, 9);
  } else if (vsHand) {
    const projected = projectLineup(args.recent, vsHand);
    if (projected.lineup.length >= 8) {
      lineupState = "Projected";
      players = projected.lineup.slice(0, 9);
    }
  }

  const rows = players.map((p, idx) =>
    scoreBatter({
      player: p,
      order: idx + 1,
      person: args.people.get(p.id),
      vsPitcher: args.vsPitcher,
      otherTypes: args.vsPitcher.otherTypes,
      store: args.store,
    }),
  );

  return {
    teamId: args.teamId,
    teamName: args.teamName,
    abbreviation: args.abbreviation,
    lineupState,
    lineup: rows,
    chips: [],
  };
}

function starterCard(
  probable: { id: number; fullName: string } | undefined,
  people: Map<number, Person>,
  store: SavantStore,
): StarterCard {
  if (!probable) {
    return {
      playerId: null,
      name: null,
      throws: null,
      topPitches: [],
      mix: [],
      otherUsage: 0,
      otherTypes: [],
      mixQualityXwoba: null,
      missingReason: "No probable pitcher posted on the MLB schedule.",
    };
  }
  const throws = people.get(probable.id)?.pitchHand ?? null;
  const usage = store.pitcherUsage.get(probable.id);
  const vsType = store.pitcherVsType.get(probable.id);
  if (!usage && !vsType) {
    return {
      playerId: probable.id,
      name: probable.fullName,
      throws,
      topPitches: [],
      mix: [],
      otherUsage: 0,
      otherTypes: [],
      mixQualityXwoba: null,
      missingReason: `No 2026 pitch-mix sample on Savant for ${probable.fullName}.`,
    };
  }
  const rawUsage = usage ?? Object.fromEntries([...(vsType?.entries() ?? [])].map(([t, r]) => [t, r.pitches]));
  const { mix, otherUsage, otherTypes, mixQualityXwoba } = buildPitcherMix(rawUsage, vsType);
  return {
    playerId: probable.id,
    name: probable.fullName,
    throws,
    topPitches: mix.filter((m) => m.type !== "OTHER").slice(0, 3).map((m) => ({ type: m.type, usage: m.usage })),
    mix,
    otherUsage,
    otherTypes,
    mixQualityXwoba,
    missingReason: null,
  };
}

function scoreBatter(args: {
  player: OfficialLineupPlayer;
  order: number;
  person: Person | undefined;
  vsPitcher: StarterCard;
  otherTypes: string[];
  store: SavantStore;
}): BatterRow {
  const batSide = args.person?.batSide ?? null;
  const stand = standVsPitcher(batSide, args.vsPitcher.throws);
  const handKey = args.vsPitcher.throws;
  const vsHand = handKey && args.player.id ? args.store.batterVsHand.get(`${args.player.id}-${handKey}`) : undefined;
  const batterVsType = args.store.batterVsType.get(args.player.id);
  const { proj, comparisonPa, confidence, missingReason } = projectBatter({
    mix: args.vsPitcher.mix,
    otherTypes: args.otherTypes,
    batterVsType,
    vsHand,
  });

  const league = handKey ? args.store.league[handKey] : null;
  const edges =
    league && league.pa > 0
      ? edgesFromProj(proj, league)
      : { hitsXwobaPoints: null, kWhiffPp: null, hrBarrelPp: null, hrXslgPoints: null };

  const chips = missingReason ? [] : chipsForEdges(edges);
  const why = missingReason
    ? missingReason
    : args.vsPitcher.missingReason
      ? args.vsPitcher.missingReason
      : buildWhy({
          mix: args.vsPitcher.mix,
          otherTypes: args.otherTypes,
          batterVsType,
          vsHand,
          pitcherName: args.vsPitcher.name,
          hitsEdge: edges.hitsXwobaPoints,
        });

  return {
    playerId: args.player.id,
    name: args.player.fullName,
    battingOrder: args.order,
    position: args.player.position,
    batSide,
    standVsPitcher: stand,
    proj,
    edges,
    comparisonPa,
    confidence,
    chips,
    why,
    missingReason,
  };
}

export function starterSummary(card: StarterCard): string {
  if (!card.name) return "TBD";
  const hand = card.throws ? ` ${card.throws}HP` : "";
  const mix = topPitchLabels(card.topPitches);
  return mix ? `${card.name}${hand} · ${mix}` : `${card.name}${hand}`;
}

export function combinedLineupLabel(game: GameCard): string {
  if (game.lineupState === "Split") {
    return `Away ${game.away.lineupState} · Home ${game.home.lineupState}`;
  }
  return game.lineupState;
}
