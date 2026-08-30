import { fmtInt, fmtPct, fmtRate, fmtXwoba, handLabel, pitchLabel } from "@/lib/format";
import type { StarterCard } from "@/lib/types";

export function MixCard({ card, side }: { card: StarterCard; side: string }) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <div className="eyebrow">{side} starter mix · 2026 usage</div>
          <h2>
            {card.name ?? "Pitcher TBD"}{" "}
            <span className="meta">{handLabel(card.throws)}</span>
          </h2>
        </div>
      </div>
      {card.missingReason ? <p className="error">{card.missingReason}</p> : null}
      <p className="dampener">
        Pitcher-mix quality dampener ×0.5 is applied to every batter edge on this card.
        It is a flat research shrink, not a coefficient fitted to betting results. Pitcher
        mix xwOBA (usage-weighted): {fmtXwoba(card.mixQualityXwoba)}.
      </p>
      {card.mix.length ? (
        <>
          <div className="mix-bars">
            {card.mix.map((m) => (
              <div className="mix-row" key={m.type}>
                <span>{m.type === "OTHER" ? "Other" : m.type}</span>
                <div className="bar">
                  <i style={{ width: `${Math.min(100, m.usage * 100)}%` }} />
                </div>
                <span className="num">{fmtPct(m.usage)}</span>
              </div>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th className="num">Usage</th>
                  <th className="num">xwOBA</th>
                  <th className="num">xBA</th>
                  <th className="num">xSLG</th>
                  <th className="num">Whiff</th>
                  <th className="num">Barrel</th>
                  <th className="num">Hard hit</th>
                  <th className="num">RV/100</th>
                  <th className="num">PA</th>
                </tr>
              </thead>
              <tbody>
                {card.mix.map((m) => (
                  <tr key={m.type}>
                    <td>
                      {m.type === "OTHER" ? "Other (<8% / non-core)" : `${m.type} ${pitchLabel(m.type)}`}
                    </td>
                    <td className="num">{fmtPct(m.usage)}</td>
                    <td className="num">{fmtXwoba(m.xwoba)}</td>
                    <td className="num">{fmtRate(m.xba)}</td>
                    <td className="num">{fmtRate(m.xslg)}</td>
                    <td className="num">{m.whiff == null ? "—" : m.whiff.toFixed(1)}</td>
                    <td className="num">{m.barrel == null ? "—" : m.barrel.toFixed(1)}</td>
                    <td className="num">{m.hardHit == null ? "—" : m.hardHit.toFixed(1)}</td>
                    <td className="num">{fmtRate(m.rv100, 1)}</td>
                    <td className="num">{fmtInt(m.pa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footer">
            Pitcher barrel % is not on the pitch-arsenal-stats CSV. A dash means the
            leaderboard did not export that split — it is not a zero.
          </p>
        </>
      ) : null}
    </section>
  );
}
