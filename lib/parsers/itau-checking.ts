// Import from the internal lib path to avoid pdf-parse v1's test-on-import behavior
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buffer: Buffer) => Promise<{ text: string }>;
import type { FileParser, ParsedRow } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a Brazilian amount string like "6.553,08" or "-1.475,00".
 * Returns null for anything that doesn't look like a number.
 */
function parseBRL(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const isNegative = trimmed.startsWith("-");
  const clean = trimmed
    .replace(/^-/, "")    // remove leading minus
    .replace(/\./g, "")   // remove thousand separators
    .replace(",", ".");   // decimal comma → dot

  const value = parseFloat(clean);
  return isNaN(value) ? null : (isNegative ? -value : value);
}

const SKIP_DESCRIPTIONS = new Set(["SALDO DO DIA"]);

/**
 * Handles PIX transactions where the description embeds a "DD/MM" date reference
 * immediately before the amount, e.g.:
 *   "PIX TRANSF FLAVIA 20/026.553,08"
 *              description──────────┘└─amount
 * The leading group of the amount must NOT start with 0 followed by more digits
 * (i.e. "026..." is not a valid BRL amount — "6..." is).
 * Captures only the amount portion (group 1).
 */
const DATE_PREFIX_AMOUNT_RE = /\d{2}\/\d{2}(-?(?:0(?=,)|[1-9]\d{0,2})(?:\.\d{3})*,\d{2})$/;

/**
 * General: BRL amount anchored to end of string.
 * Leading group follows the no-leading-zero rule.
 * e.g. "PAGTO-681,20"       → captures "-681,20"
 *      "SALDO DO DIA7.990,71" → captures "7.990,71"
 */
const AMOUNT_AT_END_RE = /(-?(?:0(?=,)|[1-9]\d{0,2})(?:\.\d{3})*,\d{2})$/;

/**
 * Matches a line that is ONLY a BRL amount (continuation line).
 * e.g. "2.000,00"
 */
const AMOUNT_ONLY_RE = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export const itauCheckingParser: FileParser = {
  id:     "itau-checking",
  name:   "Itaú – Extrato Conta Corrente",
  accept: ".pdf",

  async parse(buffer: Buffer): Promise<ParsedRow[]> {
    const result = await pdfParse(buffer);
    const lines  = result.text.split(/\r?\n/);
    const rows: ParsedRow[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Must start with a date DD/MM/YYYY (exactly 10 chars, no trailing space required)
      const dateMatch = line.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (!dateMatch) continue;

      const [, day, month, year] = dateMatch;
      const date = `${year}-${month}-${day}`;
      // "DD/MM/YYYY" is always 10 chars; description+amount follow immediately
      const rest = line.slice(10);

      let description: string;
      let amountStr:   string;

      // Case 1: amount is at the end of this line (most common).
      // Try the date-prefix pattern first so PIX entries like
      // "PIX TRANSF FLAVIA 20/026.553,08" correctly yield amount "6.553,08"
      // (not "26.553,08" which would absorb the trailing "02" date digits).
      const amountMatch = rest.match(DATE_PREFIX_AMOUNT_RE) ?? rest.match(AMOUNT_AT_END_RE);
      if (amountMatch) {
        amountStr   = amountMatch[1];
        description = rest.slice(0, rest.length - amountStr.length).trim();
      } else {
        // Case 2: amount is on the very next line (e.g. "PIX TRANSF CAPISTR09/02\n2.000,00")
        const nextLine = lines[i + 1]?.trim() ?? "";
        if (AMOUNT_ONLY_RE.test(nextLine)) {
          amountStr   = nextLine;
          description = rest.trim();
          i++; // consume the continuation line
        } else {
          continue;
        }
      }

      if (!description || SKIP_DESCRIPTIONS.has(description)) continue;

      const amount = parseBRL(amountStr);
      if (amount === null || amount === 0) continue;

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
