"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TransactionRow } from "@/components/transaction-form";
import type { RecipientDetail } from "@/lib/repositories/recipient.repository";
import { Check, ChevronsUpDown, Unlink } from "lucide-react";
import { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Similarity scoring (word-overlap, same as orphan-recipients)
// ---------------------------------------------------------------------------

function nameSimilarity(raw: string, recipientName: string): number {
  const tokenise = (s: string) =>
    s.toUpperCase().replace(/[^A-Z0-9]/g, " ").split(/\s+/).filter(Boolean);
  const wa = tokenise(raw);
  const wb = tokenise(recipientName);
  if (wa.length === 0 || wb.length === 0) return 0;
  const setA = new Set(wa);
  let score = 0;
  for (const w of wb) {
    if (setA.has(w)) {
      score += 1;
    } else {
      for (const aw of wa) {
        if (aw.startsWith(w) || w.startsWith(aw)) { score += 0.5; break; }
      }
    }
  }
  return score / Math.max(wa.length, wb.length);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LinkRecipientDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  transaction:  TransactionRow;
  allRecipients: RecipientDetail[];
  onLinked: (recipientId: string | null, recipientName: string | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinkRecipientDialog({
  open,
  onOpenChange,
  transaction,
  allRecipients,
  onLinked,
}: LinkRecipientDialogProps) {
  const [linking,   setLinking]   = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [pickOpen,  setPickOpen]  = useState(false);

  const rawLabel = transaction.recipient ?? "";
  const coaCode  = transaction.coaCode;

  // Score recipients: name similarity + same COA bonus
  const suggestions = useMemo(() => {
    return allRecipients
      .map((r) => {
        const sim     = nameSimilarity(rawLabel, r.name);
        const sameCoa = !!coaCode && r.coas.some((c) => c.coaCode === coaCode);
        return { r, sim, sameCoa, score: sim + (sameCoa ? 0.5 : 0) };
      })
      .filter(({ sim, sameCoa }) => sim >= 0.2 || sameCoa)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [rawLabel, coaCode, allRecipients]);

  async function link(recipientId: string, recipientName: string) {
    setLinking(recipientId);
    try {
      await fetch(`/api/transactions/${transaction.id}/recipient`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ recipientId }),
      });
      onLinked(recipientId, recipientName);
      onOpenChange(false);
    } finally {
      setLinking(null);
    }
  }

  async function unlink() {
    setUnlinking(true);
    try {
      await fetch(`/api/transactions/${transaction.id}/recipient`, { method: "DELETE" });
      onLinked(null, null);
      onOpenChange(false);
    } finally {
      setUnlinking(false);
    }
  }

  const isLinked = !!transaction.recipientId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle>Link to recipient</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pt-2 pb-6 space-y-6">
          {/* Transaction description */}
          <div className="rounded-md border bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Description
            </p>
            <p className="font-mono text-sm break-all">{rawLabel || "—"}</p>
            {isLinked && (
              <p className="text-xs text-primary font-medium mt-1">
                Currently linked to: {transaction.linkedRecipientName}
              </p>
            )}
          </div>

          {/* Suggested matches */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Suggested matches
              </p>
              <ul className="space-y-2">
                {suggestions.map(({ r, sameCoa }) => {
                  const isCurrent = r.id === transaction.recipientId;
                  return (
                    <li
                      key={r.id}
                      className={`flex items-center gap-3 rounded-md border px-3 py-2.5 ${
                        isCurrent ? "border-primary/40 bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        {r.coas.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {r.coas.map((c) => (
                              <span
                                key={c.coaCode}
                                className={`font-mono mr-2 ${
                                  sameCoa && c.coaCode === coaCode
                                    ? "text-primary font-semibold"
                                    : ""
                                }`}
                              >
                                {c.coaCode}{c.coaName ? ` · ${c.coaName}` : ""}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                      {sameCoa && (
                        <span className="shrink-0 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          Same COA
                        </span>
                      )}
                      {isCurrent ? (
                        <span className="shrink-0 text-[10px] font-semibold text-primary">
                          Linked
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!linking}
                          onClick={() => link(r.id, r.name)}
                          className="shrink-0"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          {linking === r.id ? "Linking…" : "Link"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Pick any recipient */}
          <div className={suggestions.length > 0 ? "border-t pt-4 space-y-2" : "space-y-2"}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Pick any recipient
            </p>
            <Popover open={pickOpen} onOpenChange={setPickOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal text-sm"
                >
                  <span className="text-muted-foreground">Search recipients…</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by name…" />
                  <CommandList>
                    <CommandEmpty>No recipient found.</CommandEmpty>
                    <CommandGroup>
                      {allRecipients.map((r) => (
                        <CommandItem
                          key={r.id}
                          value={r.name}
                          onSelect={() => {
                            setPickOpen(false);
                            link(r.id, r.name);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              r.id === transaction.recipientId ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          {r.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Unlink */}
          {isLinked && (
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive gap-1.5"
                disabled={unlinking}
                onClick={unlink}
              >
                <Unlink className="h-3.5 w-3.5" />
                {unlinking ? "Unlinking…" : "Remove link"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
