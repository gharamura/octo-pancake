import { btgCheckingParser } from "./btg-checking";
import { contabilizeiCheckingParser } from "./contabilizei-checking";
import { itauCheckingParser } from "./itau-checking";
import type { FileParser } from "./types";

export type { FileParser, ParsedRow } from "./types";

export const PARSERS: FileParser[] = [btgCheckingParser, contabilizeiCheckingParser, itauCheckingParser];

export const PARSERS_META = PARSERS.map(({ id, name, accept }) => ({ id, name, accept }));

export const parserMap = new Map(PARSERS.map((p) => [p.id, p]));
