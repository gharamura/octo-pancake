import { auth } from "@/auth";
import { db } from "@/lib/db";
import { accountBalances } from "@/lib/db/schema";
import { and, eq, gte, lt, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/balances/assets/entries?assetIds=id1,id2&month=YYYY-MM
// Returns all balance entries for the given asset(s) in that calendar month.
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url      = new URL(req.url);
  const assetIds = (url.searchParams.get("assetIds") ?? "").split(",").filter(Boolean);
  const month    = url.searchParams.get("month"); // "YYYY-MM"

  if (!assetIds.length || !month) {
    return NextResponse.json({ error: "assetIds and month are required" }, { status: 400 });
  }

  const [y, m] = month.split("-").map(Number);
  const from   = new Date(y, m - 1, 1);
  const to     = new Date(y, m, 1); // exclusive

  const rows = await db
    .select()
    .from(accountBalances)
    .where(
      and(
        inArray(accountBalances.assetId, assetIds),
        gte(accountBalances.date, from),
        lt(accountBalances.date, to),
      )
    )
    .orderBy(accountBalances.date);

  return NextResponse.json({ entries: rows });
}
