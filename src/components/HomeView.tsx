import { SlateCard } from "@/components/SlateCard";
import { formatEtLong } from "@/lib/dates";
import type { Slate } from "@/lib/types";

export function HomeView({
  slate,
  savantPending = false,
}: {
  slate: Slate;
  savantPending?: boolean;
}) {
  return (
    <main className="wrap">
      <header className="topbar">
        <div className="brand">
          <div className="eyebrow">Matchup research · not a sportsbook</div>
          <h1>Today&apos;s slate</h1>
          <p className="lede">
            {formatEtLong(slate.dateEt)} · {slate.timezone}. Each bat is scored against the
            starter&apos;s pitch mix (usage-weighted vs-pitch-type expected stats). No batter-vs-this-pitcher
            H2H, no odds, no implied probabilities.
          </p>
        </div>
      </header>

      {savantPending ? (
        <div className="banner">
          Pitch mix and chips attach after Baseball Savant CSVs land. The slate below is today&apos;s MLB
          schedule — expected-stat edges are omitted until then, not filled in.
        </div>
      ) : null}

      {slate.warnings.map((w) => (
        <div key={w.message} className="error">
          {w.source}: {w.message}
        </div>
      ))}

      {!slate.games.length ? (
        <div className="card empty">No MLB games found for this date, or the schedule request failed.</div>
      ) : (
        <div className="grid games">
          {slate.games.map((game) => (
            <SlateCard key={game.gamePk} game={game} savantPending={savantPending} />
          ))}
        </div>
      )}

      <footer className="footer">
        <p>
          Edges are vs the league same-hand expected-stat baseline, then multiplied by the labeled
          pitcher-mix quality dampener (×0.5). Chips: Hits at +20 xwOBA points; HR at +2 barrel pp or
          +40 xSLG points; K at +4 whiff pp; Fade at −20 xwOBA points. Max 3 chips per game. Low-confidence
          rows (PA vs mix &lt; 25) cannot outrank large-sample rows.
        </p>
        <p>
          Sources: MLB Stats API (slate, probable pitchers, lineups) and Baseball Savant CSV exports
          (pitch-arsenals, pitch-arsenal-stats, grouped Statcast Search for vs-hand and barrel). Cached
          daily for leaderboards, ~10 minutes for the slate. We do not ingest closing prices or
          market lines.
        </p>
        {slate.cache.savantAsOf ? <p>Savant cache as of {slate.cache.savantAsOf}.</p> : null}
      </footer>
    </main>
  );
}
