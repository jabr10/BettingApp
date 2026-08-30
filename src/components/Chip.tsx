import type { Chip as ChipT, ChipKind } from "@/lib/types";

export function Chip({
  kind,
  detail,
  low,
}: {
  kind: ChipKind;
  detail?: string;
  low?: boolean;
}) {
  return (
    <span className={`chip ${kind}${low ? " low" : ""}`}>
      <b>{kind}</b>
      {detail ? <span>{detail}</span> : null}
    </span>
  );
}

export function ChipList({ chips }: { chips: ChipT[] }) {
  if (!chips.length) return <p className="meta">No chips cleared the dampened-edge bar for this game.</p>;
  return (
    <div className="chips">
      {chips.map((c) => (
        <Chip
          key={`${c.kind}-${c.playerId}`}
          kind={c.kind}
          low={c.lowConfidence}
          detail={`${c.name} · ${c.detail}`}
        />
      ))}
    </div>
  );
}
