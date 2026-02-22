export interface ParsedRow {
  tempId:           string;
  date:             string;        // "YYYY-MM-DD"
  description:      string;        // recipient (uppercase)
  amount:           number;
  // Enriched server-side after alias lookup / AI fallback:
  suggestedCoaCode:  string | null;
  suggestedCoaName:  string | null;
  suggestionSource:  "alias" | "ai" | null;
}

export interface FileParser {
  id:   string;
  name: string;
  accept: string; // file input accept attribute, e.g. ".xls,.xlsx"
  parse(buffer: Buffer): ParsedRow[];
}
