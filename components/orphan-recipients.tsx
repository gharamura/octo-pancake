"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RecipientForm } from "@/components/recipient-form";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RecipientDetail } from "@/lib/repositories/recipient.repository";
import { Check, UserPlus } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrphanRow {
  recipient:        string;
  txCount:          number;
  total:            number;
  suggestedCoaCode: string | null;
  suggestedCoaName: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtAmount(val: number): string {
  return val.toLocaleString("pt-BR", {
    style:                 "currency",
    currency:              "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Word-overlap similarity between the orphan description and a recipient name.
 * Returns a score in [0, 1]. Words are normalised to uppercase alphanumeric tokens.
 */
function nameSimilarity(orphan: string, recipientName: string): number {
  const tokenise = (s: string) =>
    s.toUpperCase().replace(/[^A-Z0-9]/g, " ").split(/\s+/).filter(Boolean);
  const wa = tokenise(orphan);
  const wb = tokenise(recipientName);
  if (wa.length === 0 || wb.length === 0) return 0;
  const setA = new Set(wa);
  let score = 0;
  for (const w of wb) {
    if (setA.has(w)) {
      score += 1;
    } else {
      // partial prefix match (e.g. "NETFLIX" in "NETFLIX*BRASIL")
      for (const aw of wa) {
        if (aw.startsWith(w) || w.startsWith(aw)) { score += 0.5; break; }
      }
    }
  }
  return score / Math.max(wa.length, wb.length);
}

// ---------------------------------------------------------------------------
// Handle sheet content
// ---------------------------------------------------------------------------

function HandleSheetContent({
  orphan,
  coaCode,
  coaName,
  allRecipients,
  onSuccess,
}: {
  orphan:        string;
  coaCode:       string | null;
  coaName:       string | null;
  allRecipients: RecipientDetail[];
  onSuccess:     () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [linking,    setLinking]    = useState<string | null>(null);

  // Score every known recipient and keep the best matches
  const matches = useMemo(() => {
    return allRecipients
      .map((r) => {
        const sim     = nameSimilarity(orphan, r.name);
        const sameCoa = !!coaCode && r.coas.some((c) => c.coaCode === coaCode);
        return { r, sim, sameCoa, score: sim + (sameCoa ? 0.5 : 0) };
      })
      .filter(({ sim, sameCoa }) => sim >= 0.25 || sameCoa)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [orphan, coaCode, allRecipients]);

  async function handleLink(recipientId: string) {
    setLinking(recipientId);
    try {
      await fetch(`/api/recipients/${recipientId}/aliases`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ alias: orphan }),
      });
      onSuccess();
    } catch {
      setLinking(null);
    }
  }

  return (
    <div className="space-y-6 pt-2">
      {/* Orphan label */}
      <div className="rounded-md border bg-muted/30 px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          Orphan description
        </p>
        <p className="font-mono text-sm break-all">{orphan}</p>
      </div>

      {/* Possible matches */}
      {matches.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Possible matches
          </p>
          <ul className="space-y-2">
            {matches.map(({ r, sameCoa }) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2.5"
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
                          {c.coaCode}
                          {c.coaName ? ` · ${c.coaName}` : ""}
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
                <Button
                  size="sm"
                  variant="outline"
                  disabled={linking === r.id}
                  onClick={() => handleLink(r.id)}
                  className="shrink-0"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  {linking === r.id ? "Linking…" : "Link"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create new recipient */}
      <div className={matches.length > 0 ? "border-t pt-4 space-y-3" : "space-y-3"}>
        {!showCreate ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => setShowCreate(true)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Create new recipient
          </Button>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Create new
            </p>
            <RecipientForm
              defaultName={orphan}
              defaultAlias={orphan}
              defaultCoaCode={coaCode ?? undefined}
              defaultCoaName={coaName ?? undefined}
              onSuccess={onSuccess}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OrphanRecipients() {
  const [rows,          setRows]          = useState<OrphanRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [allRecipients, setAllRecipients] = useState<RecipientDetail[]>([]);
  const [sheet, setSheet] = useState<{
    open:    boolean;
    orphan:  string | null;
    coaCode: string | null;
    coaName: string | null;
  }>({ open: false, orphan: null, coaCode: null, coaName: null });

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/recipients/orphans")
      .then((r) => r.json())
      .then((data: OrphanRow[]) => setRows(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetch all recipients once for match suggestions
  useEffect(() => {
    fetch("/api/recipients")
      .then((r) => r.json())
      .then((data: RecipientDetail[]) => setAllRecipients(data))
      .catch(() => {});
  }, []);

  function openSheet(row: OrphanRow) {
    setSheet({
      open:    true,
      orphan:  row.recipient,
      coaCode: row.suggestedCoaCode,
      coaName: row.suggestedCoaName,
    });
  }

  function handleSuccess() {
    const handled = sheet.orphan;
    setSheet({ open: false, orphan: null, coaCode: null, coaName: null });
    // Remove the handled orphan row locally — no need to reload all
    if (handled) setRows((prev) => prev.filter((r) => r.recipient !== handled));
    // Refresh recipient list so subsequent sheets have fresh match suggestions
    fetch("/api/recipients")
      .then((r) => r.json())
      .then((data: RecipientDetail[]) => setAllRecipients(data))
      .catch(() => {});
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No orphan recipients — all transaction descriptions are linked.
      </p>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide">
                Recipient
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap">
                Transactions
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap">
                Total
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap">
                Suggested COA
              </th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.recipient}
                className="border-b last:border-0 hover:bg-muted/20 transition-colors"
              >
                <td className="px-3 py-2 font-mono text-xs max-w-[320px] truncate">
                  {row.recipient}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {row.txCount}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums font-medium ${
                    row.total >= 0
                      ? "text-green-700 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {fmtAmount(row.total)}
                </td>
                <td className="px-3 py-2">
                  {row.suggestedCoaCode ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {row.suggestedCoaCode}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openSheet(row)}
                  >
                    Handle
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}>
        <SheetContent className="flex flex-col overflow-hidden">
          <SheetHeader>
            <SheetTitle>Handle orphan</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 pt-2 pb-6">
            {sheet.orphan && (
              <HandleSheetContent
                key={sheet.orphan}
                orphan={sheet.orphan}
                coaCode={sheet.coaCode}
                coaName={sheet.coaName}
                allRecipients={allRecipients}
                onSuccess={handleSuccess}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
