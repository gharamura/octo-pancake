import * as XLSX from "xlsx";
import type { FileParser, ParsedRow } from "./types";

export const btgCheckingParser: FileParser = {
  id:     "btg-checking",
  name:   "BTG Pactual – Extrato",
  accept: ".xls,.xlsx",

  parse(buffer: Buffer): ParsedRow[] {
    const wb   = XLSX.read(buffer, { type: "buffer" });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

    const rows: ParsedRow[] = [];

    // Rows 0–10 are metadata / header — start at row 11
    for (let i = 11; i < data.length; i++) {
      const row = data[i] as unknown[];

      const dateStr    = String(row[1]  ?? "").trim();
      const category   = String(row[2]  ?? "").trim();
      const description = String(row[6] ?? "").trim();
      const amountRaw  = row[10];

      // Skip blank rows and daily-balance summary rows
      if (!dateStr)                         continue;
      if (!description)                     continue;
      if (description === "Saldo Diário")   continue;
      if (amountRaw === "" || amountRaw === null || amountRaw === undefined) continue;

      const amount = Number(amountRaw);
      if (isNaN(amount) || amount === 0) continue;

      // "28/11/2025 14:47" → "2025-11-28"
      const datePart = dateStr.split(" ")[0];
      const [day, month, year] = datePart.split("/");
      const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

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
