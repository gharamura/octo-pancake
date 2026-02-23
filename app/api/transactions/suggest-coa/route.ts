import { auth } from "@/auth";
import { db } from "@/lib/db";
import { coaAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { suggestCoaForDescriptions } from "@/lib/ai/suggest-coa";
import { NextResponse } from "next/server";

/**
 * POST /api/transactions/suggest-coa
 * Body: string[]   — unique transaction descriptions to classify
 * Returns: Record<description, { coaCode: string; coaName: string } | null>
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured." }, { status: 503 });
  }

  const descriptions: string[] = await req.json();
  if (!Array.isArray(descriptions) || descriptions.length === 0) {
    return NextResponse.json({});
  }

  // Fetch active leaf COA accounts (exclude parent/group accounts)
  const all = await db
    .select({ code: coaAccounts.code, name: coaAccounts.name, parentCode: coaAccounts.parentCode })
    .from(coaAccounts)
    .where(eq(coaAccounts.isActive, true));

  const parentCodes = new Set(all.map((c) => c.parentCode).filter(Boolean));
  const leafCoa = all
    .filter((c) => !parentCodes.has(c.code))
    .map(({ code, name }) => ({ code, name }));

  let suggestions: Map<string, { coaCode: string; coaName: string } | null>;
  try {
    suggestions = await suggestCoaForDescriptions(descriptions, leafCoa);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[suggest-coa] AI call failed:", message);
    return NextResponse.json({ error: `AI suggestion failed: ${message}` }, { status: 500 });
  }

  // Convert Map to plain object for JSON serialization
  const result: Record<string, { coaCode: string; coaName: string } | null> = {};
  for (const desc of descriptions) {
    result[desc] = suggestions.get(desc) ?? null;
  }

  return NextResponse.json(result);
}
