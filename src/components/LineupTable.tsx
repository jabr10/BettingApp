import { Chip } from "./Chip";
import { fmtSigned } from "@/lib/format";
import type { LineupState, TeamSide } from "@/lib/types";

export function LineupTable({ side, vs }: { side: TeamSide; vs: string }) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <div className="eyebrow">Batting order vs {vs}</div>
          <h2>
            {side.teamName}{" "}
            <span className={`badge ${side.lineupState === "Not posted" ? "Not" : side.lineupState}`}>
              {side.lineupState}
            </span>
          </h2>
        </div>
      </div>
      <ProjectedBanner state={side.lineupState} />
      {!side.lineup.length ? (
        <p className="empty">Lineup not posted, and no recent games were available to project one.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Batter</th>
                <th className="num">Hits</th>
                <th className="num">K</th>
                <th className="num">HR</th>
                <th>Conf</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {side.lineup.map((row) => (
                <tr key={row.playerId}>
                  <td className="num">{row.battingOrder}</td>
                  <td>
                    <div className="name">{row.name}</div>
                    <div className="sub">
                      {row.position || "—"}
                      {row.batSide ? ` · bats ${row.batSide}` : ""}
                      {row.standVsPitcher ? ` · stands ${row.standVsPitcher}` : ""}
                    </div>
                    {row.chips.length ? (
                      <div className="chips">
                        {row.chips.map((k) => (
                          <Chip key={k} kind={k} />
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="num">{fmtSigned(row.edges.hitsXwobaPoints, 0)} xwOBA</td>
                  <td className="num">{fmtSigned(row.edges.kWhiffPp, 1)} whiff</td>
                  <td className="num">
                    {fmtSigned(row.edges.hrXslgPoints, 0)} xSLG
                    {row.edges.hrBarrelPp != null ? (
                      <>
                        <br />
                        {fmtSigned(row.edges.hrBarrelPp, 1)} brl
                      </>
                    ) : null}
                  </td>
                  <td>
                    <div className={`conf ${row.confidence === "Low confidence" ? "low" : "ok"}`}>
                      {row.confidence}
                    </div>
                    <div className="sub">{row.comparisonPa} PA vs mix</div>
                  </td>
                  <td className="why">{row.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProjectedBanner({ state }: { state: LineupState }) {
  if (state !== "Projected") return null;
  return <div className="banner">Projected lineup, not official.</div>;
}
