import { auth } from "@/auth";
import { db } from "@/lib/db";
import { coaAccounts, recipientAliases, recipientCoa } from "@/lib/db/schema";
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
  const rows   = parser.parse(buffer);

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

  const enriched = rows.map((r) => {
    const match = coaByAlias.get(r.description);
    return {
      ...r,
      suggestedCoaCode: match?.coaCode ?? null,
      suggestedCoaName: match?.coaName ?? null,
    };
  });

  return NextResponse.json({ rows: enriched, parserName: parser.name });
}
