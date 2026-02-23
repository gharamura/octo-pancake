"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TransactionRow } from "@/components/transaction-form";
import type { RecipientDetail } from "@/lib/repositories/recipient.repository";
import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Confidence = "high" | "medium" | "low";

interface SuggestionEntry {
  tx:         TransactionRow;
  coaCode:    string;
  coaName:    string | null;
  confidence: Confidence;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONFIDENCE: Record<Confidence, { badge: string; dot: string; label: string }> = {
  high:   {
    badge: "bg-green-100  text-green-800  dark:bg-green-900/40  dark:text-green-300",
    dot:   "bg-green-500",
    label: "Recipient",
  },
  medium: {
    badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    dot:   "bg-yellow-500",
    label: "COA linked",
  },
  low: {
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    dot:   "bg-orange-500",
    label: "AI",
  },
};

function getRecipientSuggestion(
  tx: TransactionRow,
  allRecipients: RecipientDetail[]
): { coaCode: string; coaName: string | null; confidence: "high" | "medium" } | null {
  const recipientId = tx.recipientId ?? tx.aliasRecipientId;
  if (!recipientId) return null;

  const recipient = allRecipients.find((r) => r.id === recipientId);
  if (!recipient || recipient.coas.length === 0) return null;

  const primary = recipient.coas.find((c) => c.isPrimary);
  const coa     = primary ?? recipient.coas[0];

  return {
    coaCode:    coa.coaCode,
    coaName:    coa.coaName,
    confidence: primary ? "high" : "medium",
  };
}

function fmtAmount(amount: string, currency: string): string {
  const val = parseFloat(amount);
  return val.toLocaleString("pt-BR", {
    style:    "currency",
    currency: currency || "BRL",
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SuggestCategoriesSheetProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  uncategorized: TransactionRow[];
  allRecipients: RecipientDetail[];
  onApplied:     () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SuggestCategoriesSheet({
  open,
  onOpenChange,
  uncategorized,
  allRecipients,
  onApplied,
}: SuggestCategoriesSheetProps) {
  const [suggestions, setSuggestions] = useState<SuggestionEntry[]>([]);
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiUsed,      setAiUsed]      = useState(false);
  const [aiError,     setAiError]     = useState<string | null>(null);
  const [applying,    setApplying]    = useState(false);
  const headerCheckRef = useRef<HTMLInputElement>(null);

  // Compute recipient-based suggestions whenever the sheet opens or data changes
  useEffect(() => {
    if (!open) return;

    const entries: SuggestionEntry[] = [];
    for (const tx of uncategorized) {
      const s = getRecipientSuggestion(tx, allRecipients);
      if (s) entries.push({ tx, ...s });
    }

    setSuggestions(entries);
    setSelected(new Set(entries.map((e) => e.tx.id)));
    setAiUsed(false);
    setAiError(null);
  }, [open, uncategorized, allRecipients]);

  // Transactions with no recipient-based suggestion yet
  const unsuggestedTxs = useMemo(() => {
    const suggestedIds = new Set(suggestions.map((s) => s.tx.id));
    return uncategorized.filter((tx) => !suggestedIds.has(tx.id));
  }, [suggestions, uncategorized]);

  // Indeterminate header checkbox
  const allIds    = suggestions.map((s) => s.tx.id);
  const allChecked  = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someChecked = allIds.some((id) => selected.has(id));

  useEffect(() => {
    const el = headerCheckRef.current;
    if (!el) return;
    el.checked       = allChecked;
    el.indeterminate = !allChecked && someChecked;
  }, [allChecked, someChecked]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(allIds));
  }

  async function fetchAiSuggestions() {
    const targets = unsuggestedTxs.filter((tx) => tx.recipient);
    if (targets.length === 0) { setAiUsed(true); return; }

    setAiLoading(true);
    setAiError(null);
    try {
      // Deduplicate descriptions — AI maps by description string
      const uniqueDescs = [...new Set(targets.map((tx) => tx.recipient!))];

      const res = await fetch("/api/transactions/suggest-coa", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(uniqueDescs),
      });

      if (!res.ok) {
        const { error } = await res.json();
        setAiError(error ?? "AI suggestion failed.");
        return;
      }

      const data: Record<string, { coaCode: string; coaName: string } | null> = await res.json();

      const newEntries: SuggestionEntry[] = [];
      for (const tx of targets) {
        const suggestion = tx.recipient ? data[tx.recipient] : null;
        if (!suggestion) continue;
        newEntries.push({
          tx,
          coaCode:    suggestion.coaCode,
          coaName:    suggestion.coaName,
          confidence: "low",
        });
      }

      setSuggestions((prev) => [...prev, ...newEntries]);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const e of newEntries) next.add(e.tx.id);
        return next;
      });

      if (newEntries.length === 0) {
        setAiError("AI could not match any description to your COA accounts.");
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAiLoading(false);
      setAiUsed(true);
    }
  }

  async function apply() {
    const items = suggestions
      .filter((s) => selected.has(s.tx.id))
      .map((s) => ({ id: s.tx.id, coaCode: s.coaCode }));

    if (items.length === 0) return;
    setApplying(true);
    try {
      await fetch("/api/transactions/categorize", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(items),
      });
      onApplied();
      onOpenChange(false);
    } finally {
      setApplying(false);
    }
  }

  // Sort: high → medium → low, then by description
  const sorted = [...suggestions].sort((a, b) => {
    const order: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };
    if (order[a.confidence] !== order[b.confidence]) {
      return order[a.confidence] - order[b.confidence];
    }
    return (a.tx.recipient ?? "").localeCompare(b.tx.recipient ?? "");
  });

  const selectedCount = suggestions.filter((s) => selected.has(s.tx.id)).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Suggest Categories</SheetTitle>
        </SheetHeader>

        {/* Summary + legend */}
        <div className="px-6 pb-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            {uncategorized.length} uncategorized
            {suggestions.length > 0 && ` · ${suggestions.length} with suggestions`}
            {unsuggestedTxs.length > 0 && !aiUsed && ` · ${unsuggestedTxs.length} without`}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {(["high", "medium", "low"] as Confidence[]).map((c) => (
              <span
                key={c}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${CONFIDENCE[c].badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${CONFIDENCE[c].dot}`} />
                {CONFIDENCE[c].label}
              </span>
            ))}
          </div>
        </div>

        {/* Select-all header */}
        {suggestions.length > 0 && (
          <div className="px-6 flex items-center gap-2 border-b border-t py-2 bg-muted/20">
            <input
              ref={headerCheckRef}
              type="checkbox"
              onChange={toggleAll}
              className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
            />
            <span className="text-xs text-muted-foreground">
              {selectedCount} of {suggestions.length} selected
            </span>
          </div>
        )}

        {/* Suggestion list */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-1">
          {sorted.length === 0 && !aiLoading && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No suggestions yet.
            </p>
          )}

          {sorted.map((entry) => {
            const { badge } = CONFIDENCE[entry.confidence];
            const isSelected = selected.has(entry.tx.id);
            const amountVal  = parseFloat(entry.tx.amount);
            const amountColor = amountVal >= 0
              ? "text-green-700 dark:text-green-400"
              : "text-red-600 dark:text-red-400";

            return (
              <label
                key={entry.tx.id}
                className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                  isSelected ? "border-primary/30 bg-primary/5" : "hover:bg-muted/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(entry.tx.id)}
                  className="h-4 w-4 cursor-pointer rounded border-border accent-primary shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs truncate">{entry.tx.recipient ?? "—"}</p>
                  <p className={`text-xs tabular-nums ${amountColor}`}>
                    {fmtAmount(entry.tx.amount, entry.tx.currency)}
                  </p>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${badge}`}>
                  {entry.coaCode}{entry.coaName ? ` · ${entry.coaName}` : ""}
                </span>
              </label>
            );
          })}

          {/* Transactions with no suggestion (after AI was used) */}
          {aiUsed && unsuggestedTxs.length > 0 && (
            <div className={`${sorted.length > 0 ? "border-t pt-3 mt-1" : ""} space-y-1`}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground pb-1">
                No suggestion found
              </p>
              {unsuggestedTxs.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 opacity-40"
                >
                  <div className="w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs truncate">{tx.recipient ?? "—"}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">—</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 pt-3 pb-4 space-y-2">
          {aiError && (
            <p className="text-xs text-destructive">{aiError}</p>
          )}

          {!aiUsed && unsuggestedTxs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={fetchAiSuggestions}
              disabled={aiLoading}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiLoading
                ? "Asking AI…"
                : `Use AI for ${unsuggestedTxs.length} remaining`}
            </Button>
          )}

          <Button
            className="w-full"
            onClick={apply}
            disabled={selectedCount === 0 || applying}
          >
            {applying
              ? "Applying…"
              : `Apply ${selectedCount} suggestion${selectedCount !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
