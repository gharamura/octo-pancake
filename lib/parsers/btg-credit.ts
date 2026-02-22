import * as XLSX from "xlsx";
import type { FileParser, ParsedRow } from "./types";

/**
 * Convert an Excel date serial number to an ISO date string (YYYY-MM-DD).
 * Excel serial 25569 = 1970-01-01 (Unix epoch). Uses UTC to avoid timezone shifts.
 */
function excelSerialToISODate(serial: number): string {
  const d = new Date((serial - 25569) * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const btgCreditParser: FileParser = {
  id:     "btg-credit",
  name:   "BTG Pactual – Fatura Cartão",
  accept: ".xlsx",

  parse(buffer: Buffer): ParsedRow[] {
    const wb   = XLSX.read(buffer, { type: "buffer" });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

    const rows: ParsedRow[] = [];

    // Find the purchases section header row:
    // ["Data","Descrição","","Valor","Tipo de compra","Código de autorização","Final Cartão"]
    let startRow = -1;
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as unknown[];
      if (
        String(row[0]).trim() === "Data" &&
        String(row[1]).trim() === "Descrição" &&
        String(row[4]).trim() === "Tipo de compra"
      ) {
        startRow = i + 1;
        break;
      }
    }

    if (startRow === -1) return rows;

    for (let i = startRow; i < data.length; i++) {
      const row = data[i] as unknown[];

      // Date must be an Excel serial number (number type)
      const dateRaw     = row[0];
      const description = String(row[1] ?? "").trim();
      const amountRaw   = row[3];

      if (typeof dateRaw !== "number" || !dateRaw) continue;
      if (!description) continue;
      if (amountRaw === "" || amountRaw === null || amountRaw === undefined) continue;

      const amount = Number(amountRaw);
      if (isNaN(amount) || amount === 0) continue;

      const date = excelSerialToISODate(dateRaw);

      rows.push({
        tempId:           crypto.randomUUID(),
        date,
        description:      description.toUpperCase(),
        // Credit card charges are positive in the statement but are expenses (outflows)
        amount:           -amount,
        suggestedCoaCode: null,
        suggestedCoaName: null,
        suggestionSource: null,
      });
    }

    return rows;
  },
};
