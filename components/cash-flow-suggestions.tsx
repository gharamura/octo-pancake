"use client";

import type { TransferSuggestion, WithdrawalSuggestion } from "@/lib/cash-flow/suggestions";
import { ArrowRight, TrendingDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatAmount(currency: string, amount: number): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ---------------------------------------------------------------------------
// Transfer suggestions card
// ---------------------------------------------------------------------------

function TransferSuggestionsCard({ suggestions }: { suggestions: TransferSuggestion[] }) {
  return (
    <div className="rounded-md border p-4 space-y-3">
      <h3 className="font-semibold text-sm">Transfer Suggestions</h3>
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transfers needed — all accounts remain solvent.</p>
      ) : (
        <ul className="space-y-3">
          {suggestions.map((s, i) => (
            <li key={i} className="rounded-sm border bg-muted/40 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">{s.fromAccountName}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{s.toAccountName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm tabular-nums font-semibold">
                  {formatAmount(s.currency, s.amount)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Before day {s.suggestByDay}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{s.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Withdrawal suggestions card
// ---------------------------------------------------------------------------

function WithdrawalSuggestionsCard({ suggestions }: { suggestions: WithdrawalSuggestion[] }) {
  return (
    <div className="rounded-md border p-4 space-y-3">
      <h3 className="font-semibold text-sm">Investment Withdrawal Suggestions</h3>
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No withdrawals needed — all accounts remain solvent.</p>
      ) : (
        <ul className="space-y-3">
          {suggestions.map((s, i) => (
            <li key={i} className="rounded-sm border bg-muted/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{s.assetName}</p>
                  <p className="text-xs text-muted-foreground">{s.accountName}</p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="text-sm tabular-nums font-semibold">
                    {fmt.format(s.suggestedAmount)}
                  </p>
                  <span className="text-xs rounded-sm bg-muted px-1.5 py-0.5 text-muted-foreground">
                    {s.liquidityLabel}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Liquidity: {s.liquidityScore}/4</span>
                <span>Performance: {s.performanceScore >= 0 ? "+" : ""}{s.performanceScore.toFixed(1)}%</span>
              </div>
              <p className="text-xs text-muted-foreground">{s.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface CashFlowSuggestionsProps {
  transferSuggestions: TransferSuggestion[];
  withdrawalSuggestions: WithdrawalSuggestion[];
}

export function CashFlowSuggestions({
  transferSuggestions,
  withdrawalSuggestions,
}: CashFlowSuggestionsProps) {
  return (
    <div className="space-y-4">
      <TransferSuggestionsCard suggestions={transferSuggestions} />
      <WithdrawalSuggestionsCard suggestions={withdrawalSuggestions} />
    </div>
  );
}
