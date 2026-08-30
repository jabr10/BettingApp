import Link from "next/link";
import { ChipList } from "./Chip";
import { combinedLineupLabel, starterSummary } from "@/lib/slate";
import type { GameCard } from "@/lib/types";

export function SlateCard({
  game,
  savantPending = false,
}: {
  game: GameCard;
  savantPending?: boolean;
}) {
  return (
    <Link href={`/game/${game.gamePk}`} className="card game">
      <div className="card-head">
        <div>
          <div className="matchup">
            {game.away.abbreviation} @ {game.home.abbreviation}
          </div>
          <div className="meta">
            {game.gameTimeEt}
            {game.status && game.status !== "Scheduled" ? ` · ${game.status}` : ""}
          </div>
          <div className="park">{game.park}</div>
        </div>
        <span className={`badge ${game.lineupState === "Not posted" ? "Not" : game.lineupState}`}>
          {combinedLineupLabel(game)}
        </span>
      </div>
      <div className="pitchers">
        <div className="pitcher-row">
          <span className="side-lab">Away SP</span>
          <b>{starterSummary(game.away.starter)}</b>
        </div>
        <div className="pitcher-row">
          <span className="side-lab">Home SP</span>
          <b>{starterSummary(game.home.starter)}</b>
        </div>
      </div>
      {savantPending ? (
        <p className="meta">Chips pending Baseball Savant pitch-mix files.</p>
      ) : (
        <ChipList chips={game.chips} />
      )}
    </Link>
  );
}
