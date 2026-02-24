import * as XLSX from "xlsx";
import type { FileParser, ParsedRow } from "./types";

/**
 * Convert an Excel date serial number to an ISO date string (YYYY-MM-DD).
 * Excel serial 25569 = 1970-01-01 (Unix epoch). Uses UTC to avoid timezone shifts.
 */
function excelSerialToISODate(serial: number): string {
  const d = new Date((serial - 25569) * 86400000);
  const y   = d.getUTCFullYear();
  const m   = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parser for the BTG Black legacy spreadsheet exported from the previous system.
 *
 * Column layout (0-indexed):
 *   0  account          – financial account UUID (ignored; account is selected in the UI)
 *   1  recipient        – merchant / payee name
 *   2  transaction date – Excel date serial
 *   3  amont            – transaction amount (positive = credit, negative = debit)
 *   4  notes            – free-text memo
 *   5  accounting date  – Excel date serial (may differ from transaction date)
 *   6  Conta            – COA code in dot notation, e.g. "2.3.1"
 *   7  coa code         – legacy numeric code (ignored)
 *
 * The COA code is carried directly from the file (suggestionSource = "legacy") so
 * the enrichment step in the parse route will not overwrite it with alias/AI values.
 */
export const btgBlackLegacyParser: FileParser = {
  id:     "btg-black-legacy",
  name:   "BTG Black – Legado",
  accept: ".xlsx",

  parse(buffer: Buffer): ParsedRow[] {
    const wb   = XLSX.read(buffer, { type: "buffer" });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

    const rows: ParsedRow[] = [];

    // Row 0 is the header row — start from row 1
    for (let i = 1; i < data.length; i++) {
      const row = data[i] as unknown[];

      const recipient   = String(row[1] ?? "").trim();
      const txDateRaw   = row[2];
      const amountRaw   = row[3];
      const notesRaw    = String(row[4] ?? "").trim();
      const acctDateRaw = row[5];
      const coaCode     = String(row[6] ?? "").trim();

      if (!recipient) continue;
      if (typeof txDateRaw !== "number" || !txDateRaw) continue;
      if (amountRaw === "" || amountRaw === null || amountRaw === undefined) continue;

      const amount = Number(amountRaw);
      if (isNaN(amount) || amount === 0) continue;

      const date           = excelSerialToISODate(txDateRaw);
      const accountingDate =
        typeof acctDateRaw === "number" && acctDateRaw
          ? excelSerialToISODate(acctDateRaw)
          : null;

      rows.push({
        tempId:           crypto.randomUUID(),
        date,
        description:      recipient.toUpperCase(),
        amount,
        accountingDate,
        notes:            notesRaw || null,
        suggestedCoaCode: coaCode || null,
        suggestedCoaName: null,
        suggestionSource: coaCode ? "legacy" : null,
      });
    }

    return rows;
  },
};
