import { auth } from "@/auth";
import { db } from "@/lib/db";
import { coaAccounts, recipientAliases, recipientCoa } from "@/lib/db/schema";
import { suggestCoaForDescriptions } from "@/lib/ai/suggest-coa";
import { parserMap } from "@/lib/parsers";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form     = await req.formData();
  const file     = form.get("file")     as File   | null;
  const parserId = form.get("parserId") as string | null;

  if (!file || !parserId) {
    return NextResponse.json({ error: "file and parserId are required." }, { status: 400 });
  }

  const parser = parserMap.get(parserId);
  if (!parser) {
    return NextResponse.json({ error: `Unknown parser: ${parserId}` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rows   = await parser.parse(buffer);

  // ── Enrich with COA suggestions via alias lookup ────────────────────────
  const descriptions = [...new Set(rows.map((r) => r.description))];

  const matches = await db
    .select({
      alias:   recipientAliases.alias,
      coaCode: recipientCoa.coaCode,
      coaName: coaAccounts.name,
    })
    .from(recipientAliases)
    .innerJoin(
      recipientCoa,
      and(
        eq(recipientCoa.recipientId, recipientAliases.recipientId),
        eq(recipientCoa.isPrimary, true)
      )
    )
    .innerJoin(coaAccounts, eq(coaAccounts.code, recipientCoa.coaCode))
    .where(inArray(recipientAliases.alias, descriptions));

  const coaByAlias = new Map(matches.map((m) => [m.alias, { coaCode: m.coaCode, coaName: m.coaName }]));

  // ── AI fallback for unmatched descriptions ──────────────────────────────
  const unmatched = descriptions.filter((d) => !coaByAlias.has(d));

  let aiSuggestions = new Map<string, { coaCode: string; coaName: string } | null>();
  if (unmatched.length > 0 && process.env.ANTHROPIC_API_KEY) {
    const allCoa = await db
      .select({ code: coaAccounts.code, name: coaAccounts.name })
      .from(coaAccounts)
      .where(eq(coaAccounts.isActive, true));

    aiSuggestions = await suggestCoaForDescriptions(unmatched, allCoa);
  }

  // ── Merge results ───────────────────────────────────────────────────────
  const enriched = rows.map((r) => {
    const aliasMatch = coaByAlias.get(r.description);
    if (aliasMatch) {
      return { ...r, suggestedCoaCode: aliasMatch.coaCode, suggestedCoaName: aliasMatch.coaName, suggestionSource: "alias" as const };
    }
    const aiMatch = aiSuggestions.get(r.description) ?? null;
    return {
      ...r,
      suggestedCoaCode: aiMatch?.coaCode ?? null,
      suggestedCoaName: aiMatch?.coaName ?? null,
      suggestionSource: aiMatch ? ("ai" as const) : null,
    };
  });

  return NextResponse.json({ rows: enriched, parserName: parser.name });
}
