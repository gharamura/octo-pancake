"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type TransactionRow } from "@/components/transaction-form";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const s = typeof value === "string" ? value : value.toISOString();
  const [year, month, day] = s.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function fmtAmount(amount: string, currency: string): string {
  return parseFloat(amount).toLocaleString("pt-BR", { style: "currency", currency });
}

// ---------------------------------------------------------------------------
// TransactionSummary — compact display of one transaction
// ---------------------------------------------------------------------------

function TransactionSummary({
  t,
  highlight,
}: {
  t: TransactionRow;
  highlight?: boolean;
}) {
  const val = parseFloat(t.amount);
  const color = val >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400";
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm space-y-0.5 ${
        highlight ? "border-primary bg-primary/5" : "bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium">{t.accountName ?? "—"}</span>
        <span className={`tabular-nums font-semibold ${color}`}>
          {fmtAmount(t.amount, t.currency ?? "BRL")}
        </span>
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <span>{fmt(t.transactionDate)}</span>
        {t.recipient && <span>· {t.recipient}</span>}
        <span className="font-mono">· {t.coaCode}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinkTransferDialog — pick a counterpart to link
// ---------------------------------------------------------------------------

interface LinkTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The transaction we're trying to link. */
  transaction: TransactionRow;
  /** All unlinked transfer transactions (COA 3110 or 3120, transferId null), excluding `transaction`. */
  candidates: TransactionRow[];
  onLinked: (transferId: string) => void;
}

export function LinkTransferDialog({
  open,
  onOpenChange,
  transaction,
  candidates,
  onLinked,
}: LinkTransferDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleLink = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id1: transaction.id, id2: selectedId }),
      });
      const data = await res.json();
      if (res.ok) {
        onLinked(data.transferId);
        onOpenChange(false);
        setSelectedId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link Transfer</DialogTitle>
          <DialogDescription>
            Select the counterpart transaction to complete this transfer pair.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            This transaction
          </p>
          <TransactionSummary t={transaction} />

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
            Counterpart candidates
          </p>

          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No unlinked transfer transactions found.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                    selectedId === c.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedId((prev) => (prev === c.id ? null : c.id))}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">{c.accountName ?? "—"}</span>
                    <span
                      className={`tabular-nums font-semibold ${
                        parseFloat(c.amount) >= 0
                          ? "text-green-700 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {fmtAmount(c.amount, c.currency ?? "BRL")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{fmt(c.transactionDate)}</span>
                    {c.recipient && <span>· {c.recipient}</span>}
                    <span className="font-mono">· {c.coaCode}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={!selectedId || saving}>
            {saving ? "Linking…" : "Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// UnlinkTransferDialog — confirm unlinking
// ---------------------------------------------------------------------------

interface UnlinkTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One leg of the transfer. The other leg is `partner`. */
  transaction: TransactionRow;
  partner: TransactionRow | undefined;
  onUnlinked: () => void;
}

export function UnlinkTransferDialog({
  open,
  onOpenChange,
  transaction,
  partner,
  onUnlinked,
}: UnlinkTransferDialogProps) {
  const [saving, setSaving] = useState(false);

  const handleUnlink = async () => {
    if (!transaction.transferId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/transfers/${transaction.transferId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onUnlinked();
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Unlink Transfer</DialogTitle>
          <DialogDescription>
            This will remove the link between the two transfer legs. Both transactions will become
            orphans.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Transfer pair
          </p>
          <TransactionSummary t={transaction} />
          {partner ? (
            <TransactionSummary t={partner} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              Counterpart not found (already deleted?).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleUnlink} disabled={saving}>
            {saving ? "Unlinking…" : "Unlink"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
