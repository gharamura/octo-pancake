"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FinancialAccount, CoaAccount } from "@/lib/db/schema";
import { useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  // value may be an ISO string like "2024-01-15T00:00:00.000Z" or "2024-01-15"
  return value.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransactionRow {
  id: string;
  transactionDate: string;
  accountingDate: string | null;
  accountId: string;
  coaCode: string | null;
  amount: string;
  recipient: string | null;
  notes: string | null;
  accountName: string | null;
  coaName: string | null;
}

interface TransactionFormProps {
  transaction?: TransactionRow;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionForm({ transaction, onSuccess }: TransactionFormProps) {
  const isEdit = !!transaction;

  const [transactionDate, setTransactionDate] = useState(
    toDateInput(transaction?.transactionDate)
  );
  const [accountingDate, setAccountingDate] = useState(
    toDateInput(transaction?.accountingDate)
  );
  const [accountId,  setAccountId]  = useState(transaction?.accountId  ?? "");
  const [coaCode,    setCoaCode]    = useState(transaction?.coaCode    ?? "__none__");
  const [amount,     setAmount]     = useState(transaction?.amount     ?? "");
  const [recipient,  setRecipient]  = useState(transaction?.recipient  ?? "");
  const [notes,      setNotes]      = useState(transaction?.notes      ?? "");

  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [coaList,  setCoaList]  = useState<CoaAccount[]>([]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId]
  );

  const isCredit = selectedAccount?.type === "credit_card";

  // For non-credit accounts the accounting date is always the same as the
  // transaction date — keep them in sync automatically.
  useEffect(() => {
    if (!selectedAccount || isCredit) return;
    setAccountingDate(transactionDate);
  }, [transactionDate, selectedAccount, isCredit]);

  const [saving,        setSaving]        = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(setAccounts)
      .catch(() => {});
    fetch("/api/coa")
      .then((r) => r.json())
      .then(setCoaList)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        transactionDate,
        accountingDate: accountingDate || null,
        accountId,
        coaCode: coaCode === "__none__" ? null : coaCode || null,
        amount,
        recipient: recipient || null,
        notes: notes || null,
      };

      const res = await fetch(
        isEdit ? `/api/transactions/${transaction.id}` : "/api/transactions",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        return;
      }

      onSuccess();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!transaction) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not delete transaction.");
        setConfirmDelete(false);
        return;
      }
      onSuccess();
    } catch {
      setError("Something went wrong.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label>Account</Label>
        <Select value={accountId} onValueChange={setAccountId} required>
          <SelectTrigger>
            <SelectValue placeholder="Select account…" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}{a.institution ? ` · ${a.institution}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transactionDate">Transaction Date</Label>
        <Input
          id="transactionDate"
          type="date"
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recipient">Recipient</Label>
        <Input
          id="recipient"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="e.g. Supermarket, Salary"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
        <p className="text-xs text-muted-foreground">Use a negative value for expenses.</p>
      </div>

      {isCredit && (
        <div className="space-y-1.5">
          <Label htmlFor="accountingDate">Accounting Month</Label>
          <Input
            id="accountingDate"
            type="month"
            value={accountingDate.slice(0, 7)}
            onChange={(e) =>
              setAccountingDate(e.target.value ? `${e.target.value}-01` : "")
            }
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>COA Account</Label>
        <Select value={coaCode} onValueChange={setCoaCode}>
          <SelectTrigger>
            <SelectValue placeholder="Select COA account… (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None —</SelectItem>
            {coaList.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} · {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between pt-2">
        {isEdit && (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting…" : "Confirm Delete"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )
        )}

        <Button
          type="submit"
          variant={isEdit ? "warning" : "success"}
          disabled={saving || !accountId}
          className={isEdit ? "" : "ml-auto"}
        >
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Transaction"}
        </Button>
      </div>
    </form>
  );
}
