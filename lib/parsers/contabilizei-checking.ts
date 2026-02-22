import type { FileParser, ParsedRow } from "./types";

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse a Brazilian currency string like "R$ 8.699,53" or "-R$ 187,00".
 * Returns null for "-" or empty strings.
 */
function parseBRL(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") return null;

  const isNegative = trimmed.startsWith("-");
  const clean = trimmed
    .replace(/^-?\s*R\$\s*/, "") // strip "R$ " or "-R$ "
    .replace(/\./g, "")           // remove thousand separators
    .replace(",", ".");            // decimal comma → dot

  const value = parseFloat(clean);
  return isNaN(value) ? null : (isNegative ? -value : value);
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export const contabilizeiCheckingParser: FileParser = {
  id:     "contabilizei-checking",
  name:   "Contabilizei – Extrato",
  accept: ".csv",

  parse(buffer: Buffer): ParsedRow[] {
    const text  = buffer.toString("utf-8");
    const lines = text.split(/\r?\n/);
    const rows: ParsedRow[] = [];

    // Row 0 is the header — start at row 1
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Columns: [0]=Data [1]=Categoria [2]=Lançamento [3]=Descrição [4]=Entrada [5]=Saída [6]=Saldo do dia
      const cols = parseCSVLine(line);

      const dateStr     = cols[0] ?? "";
      const description = cols[3] ?? "";
      const entradaRaw  = cols[4] ?? "-";
      const saidaRaw    = cols[5] ?? "-";

      if (!dateStr || !description) continue;

      // "17/11/2025" → "2025-11-17"
      const [day, month, year] = dateStr.split("/");
      if (!day || !month || !year) continue;
      const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

      // Entrada = income (+), Saída = expense (-)
      const entrada = parseBRL(entradaRaw);
      const saida   = parseBRL(saidaRaw);

      let amount: number;
      if (entrada !== null)     amount = entrada;
      else if (saida !== null)  amount = -saida;
      else continue;

      if (amount === 0) continue;

      rows.push({
        tempId:           crypto.randomUUID(),
        date,
        description:      description.toUpperCase(),
        amount,
        suggestedCoaCode: null,
        suggestedCoaName: null,
        suggestionSource: null,
      });
    }

    return rows;
  },
};
