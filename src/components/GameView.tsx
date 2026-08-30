import Link from "next/link";
import { LineupTable } from "@/components/LineupTable";
import { MixCard } from "@/components/MixCard";
import { ChipList } from "@/components/Chip";
import { combinedLineupLabel } from "@/lib/slate";
import type { GameCard } from "@/lib/types";

export function GameView({
  game,
  savantPending = false,
}: {
  game: GameCard;
  savantPending?: boolean;
}) {
  const awaySp = game.away.starter.name ?? "TBD";
  const homeSp = game.home.starter.name ?? "TBD";

  return (
    <main className="wrap">
      <Link href="/" className="back">
        ← Today&apos;s slate
      </Link>
      <header className="topbar">
        <div className="brand">
          <div className="eyebrow">
            {game.gameTimeEt} · {game.park}
          </div>
          <h1>
            {game.away.teamName} @ {game.home.teamName}
          </h1>
          <p className="lede">
            Lineups: {combinedLineupLabel(game)}. Scored vs starter pitch mix, not batter-vs-pitcher
            H2H.
          </p>
        </div>
        <span className={`badge ${game.lineupState === "Not posted" ? "Not" : game.lineupState}`}>
          {combinedLineupLabel(game)}
        </span>
      </header>

      {savantPending ? (
        <div className="banner">
          Starter mix and vs-pitch-type edges attach after Baseball Savant CSVs land. Names and
          official lineups below are from the MLB schedule — no matchup numbers were invented.
        </div>
      ) : null}

      {game.warnings.map((w) => (
        <div key={w.message} className="error">
          {w.source}: {w.message}
        </div>
      ))}

      {game.away.lineupState === "Projected" || game.home.lineupState === "Projected" ? (
        <div className="banner">Projected lineup, not official.</div>
      ) : null}

      {savantPending ? (
        <p className="meta">Chips pending Baseball Savant pitch-mix files.</p>
      ) : (
        <ChipList chips={game.chips} />
      )}

      <div className="section two">
        <MixCard card={game.away.starter} side="Away" />
        <MixCard card={game.home.starter} side="Home" />
      </div>

      <div className="section">
        <LineupTable side={game.away} vs={homeSp} scoringPending={savantPending} />
      </div>
      <div className="section">
        <LineupTable side={game.home} vs={awaySp} scoringPending={savantPending} />
      </div>

      <footer className="footer">
        <p>
          Hits / K / HR columns are dampened edges vs the league same-hand baseline (xwOBA points,
          whiff percentage points, xSLG points / barrel percentage points). Ranked on expected stats
          only. Tiny samples stay labeled Low confidence and cannot win the slate chip sort.
        </p>
      </footer>
    </main>
  );
}
