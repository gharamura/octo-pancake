// Import from the internal lib path to avoid pdf-parse v1's test-on-import behavior
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buffer: Buffer) => Promise<{ text: string }>;
import type { FileParser, ParsedRow } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a Brazilian amount string like "931,00", "2.256,61", or "- 770,85".
 * Returns null for anything that doesn't look like a number.
 */
function parseBRL(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const isNegative = trimmed.startsWith("-");
  const clean = trimmed
    .replace(/^-\s*/, "") // remove leading minus + optional space
    .replace(/\./g, "")   // remove thousand separators
    .replace(",", ".");    // decimal comma → dot

  const value = parseFloat(clean);
  return isNaN(value) ? null : (isNegative ? -value : value);
}

/**
 * Credit-card transaction line:
 *   DD/MM<description>[NN/NN]<amount>
 *
 * Amount at the end can be:
 *   positive:  "931,00"  "2.256,61"
 *   negative:  "- 770,85"  "- 0,09"
 *
 * Some lines have an installment notation NN/NN (e.g. 02/03 = installment 2 of 3)
 * directly before the amount with no separator. When present, the last digit(s) of
 * the installment can bleed into the amount (e.g. "02/032.256,61" → "032.256,61"
 * would be parsed as 32256.61 instead of 2256.61). We handle this by trying a regex
 * WITH a required installment group first, then falling back to one without.
 */
const AMOUNT_PAT = "(- ?\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d{1,3}(?:\\.\\d{3})*,\\d{2})$";
const LINE_WITH_INST_RE = new RegExp(`^(\\d{2})\\/(\\d{2})(.+?)\\d{2}\\/\\d{2}${AMOUNT_PAT}`);
const LINE_RE            = new RegExp(`^(\\d{2})\\/(\\d{2})(.+?)${AMOUNT_PAT}`);

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export const itauCreditParser: FileParser = {
  id:     "itau-credit",
  name:   "Itaú – Fatura Cartão de Crédito",
  accept: ".pdf",

  async parse(buffer: Buffer): Promise<ParsedRow[]> {
    const result = await pdfParse(buffer);
    const lines  = result.text.split(/\r?\n/);
    const rows: ParsedRow[] = [];

    // ── 1. Determine statement year/month from "Vencimento:DD/MM/YYYY" ────
    let stmtYear  = new Date().getFullYear();
    let stmtMonth = new Date().getMonth() + 1;

    for (const line of lines) {
      const m = line.match(/Vencimento[:\s]*(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) {
        stmtMonth = parseInt(m[2], 10);
        stmtYear  = parseInt(m[3], 10);
        break;
      }
    }

    // ── 2. Parse transaction lines ────────────────────────────────────────
    let inFutureSection = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Stop parsing once we hit the "próximas faturas" section
      if (/pr[oó]ximas\s*faturas/i.test(line)) {
        inFutureSection = true;
        continue;
      }
      if (inFutureSection) continue;

      // Try with required installment notation first, then fallback
      const m = line.match(LINE_WITH_INST_RE) ?? line.match(LINE_RE);
      if (!m) continue;

      const [, dayStr, monthStr, descRaw, amountRaw] = m;
      const txDay   = parseInt(dayStr, 10);
      const txMonth = parseInt(monthStr, 10);

      // Strip trailing installment notation (e.g. "CEDIPI-CT 02/02" → "CEDIPI-CT")
      const description = descRaw.trim().replace(/\s*\d{2}\/\d{2}$/, "").trim();
      if (!description) continue;

      const amount = parseBRL(amountRaw);
      if (amount === null || amount === 0) continue;

      // Infer year: if the tx month is after the statement month it must be
      // from the previous year (e.g. Nov charge on a March bill → 2025).
      const year = txMonth > stmtMonth ? stmtYear - 1 : stmtYear;
      const date = `${year}-${String(txMonth).padStart(2, "0")}-${String(txDay).padStart(2, "0")}`;

      rows.push({
        tempId:           crypto.randomUUID(),
        date,
        description:      description.toUpperCase(),
        amount:           -amount,  // credit card charges are expenses
        suggestedCoaCode: null,
        suggestedCoaName: null,
        suggestionSource: null,
      });
    }

    // ── 3. Deduplicate ────────────────────────────────────────────────────
    // The PDF two-column layout causes future-installment rows to appear
    // BEFORE the "próximas faturas" header in extracted text.  These are
    // exact duplicates of current-period rows (same date+description+amount),
    // so we keep only the first occurrence of each.
    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      const key = `${r.date}|${r.description}|${r.amount}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique;
  },
};
