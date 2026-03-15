import { btgBlackLegacyParser } from "./btg-black-legacy";
import { btgCheckingParser } from "./btg-checking";
import { btgCreditParser } from "./btg-credit";
import { contabilizeiCheckingParser } from "./contabilizei-checking";
import { itauCheckingParser } from "./itau-checking";
import { itauCreditParser } from "./itau-credit";
import type { FileParser } from "./types";

export type { FileParser, ParsedRow } from "./types";

export const PARSERS: FileParser[] = [btgCheckingParser, btgCreditParser, contabilizeiCheckingParser, itauCheckingParser, itauCreditParser, btgBlackLegacyParser];

export const PARSERS_META = PARSERS.map(({ id, name, accept }) => ({ id, name, accept }));

export const parserMap = new Map(PARSERS.map((p) => [p.id, p]));
