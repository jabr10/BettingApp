import { PITCH_NAMES } from "./constants";

export function fmtPct(share: number | null | undefined, digits = 0): string {
  if (share == null || !Number.isFinite(share)) return "—";
  return `${(share * 100).toFixed(digits)}%`;
}

export function fmtRate(value: number | null | undefined, digits = 3): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function fmtXwoba(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(3).replace(/^0/, "");
}

export function fmtSigned(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

export function fmtInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

export function pitchLabel(type: string): string {
  return PITCH_NAMES[type] ?? type;
}

export function handLabel(hand: string | null | undefined): string {
  if (hand === "L") return "LHP";
  if (hand === "R") return "RHP";
  return "—";
}
