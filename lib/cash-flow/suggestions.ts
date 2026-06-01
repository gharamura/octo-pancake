import type { Asset } from "@/lib/db/schema";
import type { AccountBalance, AccountSummary, DayProjection } from "./calculator";

const ITAU_GRACE_DAYS = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransferSuggestion {
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  currency: string;
  suggestByDay: number; // transfer before this day
  reason: string;
}

export interface AssetBalanceWithPerformance {
  assetId: string;
  assetName: string;
  accountId: string;
  balance: number; // current balance in account currency
  performanceScore: number; // lower = better candidate (sell losers first)
}

export interface WithdrawalSuggestion {
  assetId: string;
  assetName: string;
  accountId: string;
  accountName: string;
  suggestedAmount: number;
  liquidityScore: number;
  performanceScore: number;
  liquidityLabel: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Liquidity scoring
// ---------------------------------------------------------------------------

function liquidityScore(liquidity: string | null | undefined): number {
  if (!liquidity) return 1;
  if (liquidity === "market") return 4;
  if (liquidity === "30") return 3;
  if (liquidity === "90") return 2;
  if (liquidity === "lockup") return 1;
  const days = parseInt(liquidity, 10);
  if (!isNaN(days)) {
    if (days <= 30) return 3;
    if (days <= 90) return 2;
    return 1;
  }
  return 1;
}

function liquidityLabel(liquidity: string | null | undefined): string {
  if (!liquidity) return "Unknown";
  if (liquidity === "market") return "Market";
  if (liquidity === "lockup") return "Lockup";
  const days = parseInt(liquidity, 10);
  if (!isNaN(days)) return `${days} days`;
  return liquidity;
}

// ---------------------------------------------------------------------------
// Transfer suggestions
// ---------------------------------------------------------------------------

export function generateTransferSuggestions(
  summaries: AccountSummary[],
  balances: AccountBalance[]
): TransferSuggestion[] {
  const suggestions: TransferSuggestion[] = [];

  const balanceMap = new Map<string, AccountBalance>(
    balances.map((b) => [b.accountId, b])
  );

  for (const summary of summaries) {
    if (!summary.goesNegative) continue;

    const needy = balanceMap.get(summary.accountId);
    if (!needy) continue;

    const needed = summary.shortfall * 1.1; // 10% buffer

    // Find surplus accounts in the same currency
    const surplusCandidates = summaries
      .filter(
        (s) =>
          s.accountId !== summary.accountId &&
          !s.goesNegative &&
          s.endBalance > 0
      )
      .map((s) => ({ summary: s, balance: balanceMap.get(s.accountId) }))
      .filter(
        (c) =>
          c.balance &&
          c.balance.currency === needy.currency &&
          c.summary.endBalance >= needed
      );

    if (!surplusCandidates.length) continue;

    // Pick the account with the highest end balance as source
    surplusCandidates.sort((a, b) => b.summary.endBalance - a.summary.endBalance);
    const best = surplusCandidates[0];
    if (!best.balance) continue;

    suggestions.push({
      fromAccountId: best.summary.accountId,
      fromAccountName: best.summary.accountName,
      toAccountId: summary.accountId,
      toAccountName: summary.accountName,
      amount: Math.ceil(needed * 100) / 100,
      currency: needy.currency,
      suggestByDay: Math.max(1, (summary.negativeFromDay ?? 1) - 1),
      reason: `${summary.accountName} goes negative on day ${summary.negativeFromDay}. Transfer ${needy.currency} ${needed.toFixed(2)} (shortfall + 10%) before day ${(summary.negativeFromDay ?? 1) - 1}.`,
    });
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Withdrawal suggestions
// ---------------------------------------------------------------------------

export function generateWithdrawalSuggestions(
  summaries: AccountSummary[],
  timeline: DayProjection[],
  accountInstitutions: Map<string, string>, // accountId -> institution name
  assets: Asset[],
  assetBalances: AssetBalanceWithPerformance[],
  accountBalances: AccountBalance[]
): WithdrawalSuggestion[] {
  const summaryMap = new Map(summaries.map((s) => [s.accountId, s]));

  // Determine which accounts have Itaú grace (institution contains "itaú"/"itau" and ≤10 negative days)
  const withinGrace = new Set<string>();
  for (const [accountId, institution] of accountInstitutions) {
    if (/ita[uú]/i.test(institution)) {
      const summary = summaryMap.get(accountId);
      if (summary && summary.negativeDaysCount <= ITAU_GRACE_DAYS) {
        withinGrace.add(accountId);
      }
    }
  }

  // Compute adjusted total balance per day: accounts within grace contribute max(balance, 0)
  const allIds = summaries.map((s) => s.accountId);
  let adjustedTotalGoesNegative = false;
  let maxShortfall = 0;

  for (const day of timeline) {
    const total = allIds.reduce((sum, id) => {
      const bal = day.balances[id] ?? 0;
      return sum + (withinGrace.has(id) ? Math.max(bal, 0) : bal);
    }, 0);
    if (total < 0) {
      adjustedTotalGoesNegative = true;
      maxShortfall = Math.max(maxShortfall, Math.abs(total));
    }
  }

  if (!adjustedTotalGoesNegative) return [];

  const totalShortfall = maxShortfall;

  // Build asset balance map
  const assetBalMap = new Map<string, AssetBalanceWithPerformance>(
    assetBalances.map((ab) => [ab.assetId, ab])
  );

  // Build financial account name map
  const accNameMap = new Map<string, string>(
    accountBalances.map((b) => [b.accountId, b.accountName])
  );

  // Score and rank assets
  const candidates: WithdrawalSuggestion[] = [];

  for (const asset of assets) {
    if (!asset.isActive) continue;
    const ab = assetBalMap.get(asset.id);
    if (!ab || ab.balance <= 0) continue;

    const lScore = liquidityScore(asset.liquidity);
    const lLabel = liquidityLabel(asset.liquidity);
    const pScore = ab.performanceScore;
    const accName = accNameMap.get(asset.accountId) ?? asset.accountId;

    candidates.push({
      assetId: asset.id,
      assetName: asset.name,
      accountId: asset.accountId,
      accountName: accName,
      suggestedAmount: Math.min(ab.balance, totalShortfall),
      liquidityScore: lScore,
      performanceScore: pScore,
      liquidityLabel: lLabel,
      reason: `Liquidity: ${lLabel} (score ${lScore}). Performance: ${pScore >= 0 ? "+" : ""}${pScore.toFixed(1)}% (sell ${pScore < 0 ? "loser" : "winner"} last if possible).`,
    });
  }

  // Sort: liquidity DESC, performanceScore ASC (sell worst performers first)
  candidates.sort((a, b) => {
    if (b.liquidityScore !== a.liquidityScore) return b.liquidityScore - a.liquidityScore;
    return a.performanceScore - b.performanceScore;
  });

  return candidates;
}
