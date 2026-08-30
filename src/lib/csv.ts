/** Minimal CSV parser: quoted fields, UTF-8 BOM, commas inside names. */
export function parseCsv(text: string): Record<string, string>[] {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/^\s+/, "");
  if (!cleaned || cleaned.startsWith("<!DOCTYPE") || cleaned.startsWith("<html")) {
    throw new Error("Expected CSV, received HTML");
  }
  const rows = splitCsvRows(cleaned);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length === 1 && cells[0] === "") continue;
    const rec: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      rec[headers[c]] = cells[c] ?? "";
    }
    out.push(rec);
  }
  return out;
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function num(value: string | undefined | null): number | null {
  if (value == null) return null;
  const t = String(value).trim();
  if (t === "" || t === "null" || t === "NA") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function int(value: string | undefined | null): number {
  const n = num(value);
  return n == null ? 0 : Math.round(n);
}
