import { auth } from "@/auth";
import { db } from "@/lib/db";
import { accountBalances, assets, financialAccounts } from "@/lib/db/schema";
import { recurringRepository } from "@/lib/repositories/recurring.repository";
import { spotsRepository } from "@/lib/repositories/spots.repository";
import { calculateCashFlow, type AccountBalance } from "@/lib/cash-flow/calculator";
import { generateTransferSuggestions, generateWithdrawalSuggestions, type AssetBalanceWithPerformance } from "@/lib/cash-flow/suggestions";
import { eq, isNotNull, and, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// GET /api/cash-flow?year=2026&month=6&accountIds[]=id1&accountIds[]=id2
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const yearParam  = url.searchParams.get("year");
  const monthParam = url.searchParams.get("month");
  const accountIdsParam = url.searchParams.getAll("accountIds[]");

  const now = new Date();
  const year  = yearParam  ? parseInt(yearParam,  10) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month." }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // 1. Fetch latest account balance per accountId (most recent date record)
  // ---------------------------------------------------------------------------
  const latestBalanceRows = await db.execute(sql`
    SELECT DISTINCT ON (ab.account_id)
      ab.account_id,
      ab.balance::float AS balance,
      fa.name AS account_name,
      fa.currency
    FROM account_balances ab
    JOIN financial_accounts fa ON fa.id = ab.account_id
    WHERE ab.asset_id IS NULL
    ${accountIdsParam.length > 0
      ? sql`AND ab.account_id = ANY(ARRAY[${sql.join(accountIdsParam.map((id) => sql`${id}`), sql`, `)}]::text[])`
      : sql``}
    ORDER BY ab.account_id, ab.date DESC
  `);

  const accountBalancesList: AccountBalance[] = latestBalanceRows.rows.map((r) => ({
    accountId:   r.account_id as string,
    accountName: (r.account_name as string) ?? r.account_id as string,
    balance:     Number(r.balance),
    currency:    (r.currency as string) ?? "BRL",
  }));

  // ---------------------------------------------------------------------------
  // 2. Fetch recurring transactions + spot estimates for the month
  // ---------------------------------------------------------------------------
  const [recurring, spots] = await Promise.all([
    recurringRepository.findAll(),
    spotsRepository.findByMonth(year, month),
  ]);

  const filteredRecurring = accountIdsParam.length > 0
    ? recurring.filter((r) => accountIdsParam.includes(r.accountId))
    : recurring;

  const filteredSpots = accountIdsParam.length > 0
    ? spots.filter((s) => accountIdsParam.includes(s.accountId))
    : spots;

  // Tag spots so the calculator can mark them in the timeline
  const taggedSpots = filteredSpots.map((s) => ({ ...s, isSpot: true }));

  // ---------------------------------------------------------------------------
  // 3. Calculate cash flow (recurring + spots merged)
  // ---------------------------------------------------------------------------
  const cashFlow = calculateCashFlow(
    accountBalancesList,
    [...filteredRecurring, ...taggedSpots],
    year,
    month
  );

  // ---------------------------------------------------------------------------
  // 4. Build institution map for grace-period logic
  // ---------------------------------------------------------------------------
  const accountRows = await db.select().from(financialAccounts);
  const accountInstitutions = new Map<string, string>(
    accountRows.map((a) => [a.id, a.institution ?? ""])
  );

  // ---------------------------------------------------------------------------
  // 5. Fetch assets + latest balances for withdrawal scoring
  // ---------------------------------------------------------------------------
  const assetRows = await db
    .select()
    .from(assets)
    .where(eq(assets.isActive, true));

  // 3-month performance: compare latest balance against the closest snapshot
  // on or before (today - 3 months). Falls back to earliest available if no
  // snapshot exists that far back.
  const assetPerfRows = await db.execute(sql`
    SELECT
      latest_snap.asset_id,
      latest_snap.balance::float AS latest_balance,
      latest_snap.asset_name,
      latest_snap.account_id,
      COALESCE(base_snap.balance, earliest_snap.balance)::float AS base_balance
    FROM (
      SELECT DISTINCT ON (ab.asset_id)
        ab.asset_id, ab.balance,
        a.name AS asset_name,
        a.account_id
      FROM account_balances ab
      JOIN assets a ON a.id = ab.asset_id
      WHERE ab.asset_id IS NOT NULL
      ORDER BY ab.asset_id, ab.date DESC
    ) AS latest_snap
    LEFT JOIN LATERAL (
      SELECT ab.balance
      FROM account_balances ab
      WHERE ab.asset_id = latest_snap.asset_id
        AND ab.date <= (CURRENT_DATE - INTERVAL '3 months')
      ORDER BY ab.date DESC
      LIMIT 1
    ) AS base_snap ON true
    LEFT JOIN LATERAL (
      SELECT ab.balance
      FROM account_balances ab
      WHERE ab.asset_id = latest_snap.asset_id
      ORDER BY ab.date ASC
      LIMIT 1
    ) AS earliest_snap ON true
  `);

  const assetBalancesForSuggestions: AssetBalanceWithPerformance[] =
    assetPerfRows.rows.map((r) => {
      const base   = Number(r.base_balance);
      const latest = Number(r.latest_balance);
      const performanceScore = base > 0 ? ((latest - base) / base) * 100 : 0;
      return {
        assetId:   r.asset_id as string,
        assetName: (r.asset_name as string) ?? "",
        accountId: r.account_id as string,
        balance:   latest,
        performanceScore,
      };
    });

  // ---------------------------------------------------------------------------
  // 6. Generate suggestions
  // ---------------------------------------------------------------------------
  const transferSuggestions = generateTransferSuggestions(
    cashFlow.accountSummaries,
    accountBalancesList
  );

  const withdrawalSuggestions = generateWithdrawalSuggestions(
    cashFlow.accountSummaries,
    cashFlow.timeline,
    accountInstitutions,
    assetRows,
    assetBalancesForSuggestions,
    accountBalancesList
  );

  return NextResponse.json({
    cashFlow,
    transferSuggestions,
    withdrawalSuggestions,
  });
}
