import { LINEUP_CACHE_MS, PEOPLE_CACHE_MS, STATS_API_BASE } from "./constants";
import { cacheGet, cacheSet } from "./cache";
import { fetchJson } from "./http";
import type { Hand, OfficialLineupPlayer, PastTeamGame, Person } from "./types";

type ScheduleResponse = {
  dates?: {
    date: string;
    games: ScheduleGame[];
  }[];
};

export type ScheduleGame = {
  gamePk: number;
  gameDate: string;
  officialDate?: string;
  status?: { detailedState?: string; abstractGameState?: string };
  venue?: { name?: string };
  lineups?: {
    homePlayers?: LineupPerson[];
    awayPlayers?: LineupPerson[];
  };
  teams: {
    away: ScheduleSide;
    home: ScheduleSide;
  };
};

type ScheduleSide = {
  team: { id: number; name: string; abbreviation?: string };
  probablePitcher?: { id: number; fullName: string };
};

type LineupPerson = {
  id: number;
  fullName: string;
  primaryPosition?: { abbreviation?: string };
};

type PeopleResponse = {
  people?: {
    id: number;
    fullName: string;
    batSide?: { code?: string };
    pitchHand?: { code?: string };
  }[];
};

export async function fetchSchedule(date: string): Promise<ScheduleGame[]> {
  const key = `schedule-${date}`;
  const cached = await cacheGet<ScheduleGame[]>(key, LINEUP_CACHE_MS);
  if (cached) return cached;
  const hydrate = "probablePitcher,lineups,venue,team";
  const url = `${STATS_API_BASE}/schedule?sportId=1&date=${date}&hydrate=${encodeURIComponent(hydrate)}`;
  const data = await fetchJson<ScheduleResponse>(url);
  const games = (data.dates ?? []).flatMap((d) => d.games ?? []);
  await cacheSet(key, games, LINEUP_CACHE_MS);
  return games;
}

export async function fetchRecentSchedule(startDate: string, endDate: string): Promise<ScheduleGame[]> {
  const key = `schedule-range-${startDate}-${endDate}`;
  const cached = await cacheGet<ScheduleGame[]>(key, LINEUP_CACHE_MS);
  if (cached) return cached;
  const hydrate = "probablePitcher,lineups,venue,team";
  const url = `${STATS_API_BASE}/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&hydrate=${encodeURIComponent(hydrate)}`;
  const data = await fetchJson<ScheduleResponse>(url);
  const games = (data.dates ?? []).flatMap((d) => d.games ?? []);
  await cacheSet(key, games, LINEUP_CACHE_MS);
  return games;
}

export async function fetchPeople(ids: number[]): Promise<Map<number, Person>> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  const map = new Map<number, Person>();
  const missing: number[] = [];
  for (const id of unique) {
    const cached = await cacheGet<Person>(`person-${id}`, PEOPLE_CACHE_MS);
    if (cached) map.set(id, cached);
    else missing.push(id);
  }
  const chunkSize = 80;
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);
    const url = `${STATS_API_BASE}/people?personIds=${chunk.join(",")}`;
    const data = await fetchJson<PeopleResponse>(url);
    for (const p of data.people ?? []) {
      const person: Person = {
        id: p.id,
        fullName: p.fullName,
        batSide: asHandOrS(p.batSide?.code),
        pitchHand: asHand(p.pitchHand?.code),
      };
      map.set(p.id, person);
      await cacheSet(`person-${p.id}`, person, PEOPLE_CACHE_MS);
    }
  }
  return map;
}

export function officialLineup(players: LineupPerson[] | undefined): OfficialLineupPlayer[] {
  if (!players?.length) return [];
  return players.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    position: p.primaryPosition?.abbreviation ?? "",
  }));
}

export function pastGamesForTeam(games: ScheduleGame[], teamId: number): PastTeamGame[] {
  const out: PastTeamGame[] = [];
  for (const g of games) {
    const isAway = g.teams.away.team.id === teamId;
    const isHome = g.teams.home.team.id === teamId;
    if (!isAway && !isHome) continue;
    const state = g.status?.abstractGameState;
    if (state === "Preview") continue;
    const mine = isAway ? g.teams.away : g.teams.home;
    const opp = isAway ? g.teams.home : g.teams.away;
    const lu = isAway ? g.lineups?.awayPlayers : g.lineups?.homePlayers;
    const lineup = officialLineup(lu);
    if (lineup.length < 8) continue;
    out.push({
      gamePk: g.gamePk,
      date: g.officialDate ?? g.gameDate.slice(0, 10),
      teamId: mine.team.id,
      opponentId: opp.team.id,
      opponentStarterId: opp.probablePitcher?.id ?? null,
      opponentThrows: null,
      lineup,
    });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

export function projectLineup(
  recent: PastTeamGame[],
  vsHand: Hand,
): { lineup: OfficialLineupPlayer[]; usedVsHand: boolean; gamesUsed: number } {
  const vs = recent.filter((g) => g.opponentThrows === vsHand).slice(0, 10);
  const pool = vs.length >= 3 ? vs : recent.slice(0, 10);
  const usedVsHand = vs.length >= 3;
  if (!pool.length) return { lineup: [], usedVsHand, gamesUsed: 0 };

  const slots: OfficialLineupPlayer[] = [];
  const n = Math.min(9, Math.max(...pool.map((g) => g.lineup.length)));
  for (let i = 0; i < n; i++) {
    const counts = new Map<number, { player: OfficialLineupPlayer; count: number; last: string }>();
    for (const g of pool) {
      const p = g.lineup[i];
      if (!p) continue;
      const cur = counts.get(p.id);
      if (cur) {
        cur.count += 1;
        if (g.date > cur.last) cur.last = g.date;
      } else {
        counts.set(p.id, { player: p, count: 1, last: g.date });
      }
    }
    const winner = [...counts.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.last < b.last ? 1 : -1;
    })[0];
    if (winner) slots.push(winner.player);
  }
  return { lineup: slots, usedVsHand, gamesUsed: pool.length };
}

function asHand(code: string | undefined): Hand | null {
  if (code === "L" || code === "R") return code;
  return null;
}

function asHandOrS(code: string | undefined): Hand | "S" | null {
  if (code === "L" || code === "R" || code === "S") return code;
  return null;
}
