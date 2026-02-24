export interface ParsedRow {
  tempId:           string;
  date:             string;        // "YYYY-MM-DD"
  description:      string;        // recipient (uppercase)
  amount:           number;
  accountingDate?:  string | null; // "YYYY-MM-DD" — if different from date
  notes?:           string | null;
  // Enriched server-side after alias lookup / AI fallback:
  suggestedCoaCode:  string | null;
  suggestedCoaName:  string | null;
  suggestionSource:  "alias" | "ai" | "legacy" | null;
}

export interface FileParser {
  id:   string;
  name: string;
  accept: string; // file input accept attribute, e.g. ".xls,.xlsx"
  parse(buffer: Buffer): ParsedRow[] | Promise<ParsedRow[]>;
}
