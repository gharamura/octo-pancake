"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RecipientForm } from "@/components/recipient-form";
import { useCallback, useEffect, useState } from "react";

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrphanRecipients() {
  const [rows,    setRows]    = useState<OrphanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<{ open: boolean; orphan: string | null; coaCode: string | null; coaName: string | null }>({
    open: false, orphan: null, coaCode: null, coaName: null,
  });

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/recipients/orphans")
      .then((r) => r.json())
      .then((data: OrphanRow[]) => setRows(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openSheet(row: OrphanRow) {
    setSheet({ open: true, orphan: row.recipient, coaCode: row.suggestedCoaCode, coaName: row.suggestedCoaName });
  }

  function handleSuccess() {
    setSheet({ open: false, orphan: null, coaCode: null, coaName: null });
    load();
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
              <tr key={row.recipient} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-3 py-2 font-mono text-xs max-w-[320px] truncate">
                  {row.recipient}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {row.txCount}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium ${row.total >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {fmtAmount(row.total)}
                </td>
                <td className="px-3 py-2">
                  {row.suggestedCoaCode ? (
                    <span className="font-mono text-xs text-muted-foreground">{row.suggestedCoaCode}</span>
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
                    Create Recipient
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
            <SheetTitle>New Recipient</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
            {sheet.orphan && (
              <RecipientForm
                defaultName={sheet.orphan}
                defaultAlias={sheet.orphan}
                defaultCoaCode={sheet.coaCode ?? undefined}
                defaultCoaName={sheet.coaName ?? undefined}
                onSuccess={handleSuccess}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
