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
import type { CoaAccount, FinancialAccount, RecurringTransaction } from "@/lib/db/schema";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecurringFormProps {
  record?: RecurringTransaction;
  prefill?: {
    name?: string;
    type?: "income" | "expense";
    amount?: string;
    accountId?: string;
    coaCode?: string;
    dayOfMonth?: number;
  };
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecurringForm({ record, prefill, onSuccess }: RecurringFormProps) {
  const isEdit = !!record;

  const [name,       setName]       = useState(record?.name       ?? prefill?.name       ?? "");
  const [type,       setType]       = useState<"income" | "expense">(
    (record?.type as "income" | "expense") ?? prefill?.type ?? "expense"
  );
  const [amount,     setAmount]     = useState(record?.amount     ?? prefill?.amount     ?? "");
  const [accountId,  setAccountId]  = useState(record?.accountId  ?? prefill?.accountId  ?? "");
  const [dayOfMonth, setDayOfMonth] = useState(String(record?.dayOfMonth ?? prefill?.dayOfMonth ?? ""));
  const [coaCode,    setCoaCode]    = useState(record?.coaCode    ?? prefill?.coaCode    ?? "");
  const [notes,      setNotes]      = useState(record?.notes      ?? "");

  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [coaList,  setCoaList]  = useState<CoaAccount[]>([]);

  const [saving,        setSaving]        = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: FinancialAccount[]) => setAccounts(data.filter((a) => a.isActive)))
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
      const day = parseInt(dayOfMonth, 10);
      if (isNaN(day) || day < 1 || day > 31) {
        setError("Day of month must be between 1 and 31.");
        return;
      }

      const body = {
        name,
        type,
        amount,
        accountId,
        dayOfMonth: day,
        coaCode: coaCode || null,
        notes: notes || null,
      };

      const res = await fetch(
        isEdit ? `/api/recurring/${record.id}` : "/api/recurring",
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
    if (!record) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/recurring/${record.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not delete record.");
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
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="rec-name">Name</Label>
        <Input
          id="rec-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rent, Salary…"
          required
        />
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as "income" | "expense")} required>
          <SelectTrigger>
            <SelectValue placeholder="Select type…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="rec-amount">Amount (BRL)</Label>
        <Input
          id="rec-amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
      </div>

      {/* Account */}
      <div className="space-y-1.5">
        <Label>Account</Label>
        <Select value={accountId} onValueChange={setAccountId} required>
          <SelectTrigger>
            <SelectValue placeholder="Select account…" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="flex items-center gap-2">
                  <span>{a.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{a.type.replace("_", " ")}</span>
                  {a.accountNumber && (
                    <span className="font-mono text-xs text-muted-foreground">· {a.accountNumber}</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Day of Month */}
      <div className="space-y-1.5">
        <Label htmlFor="rec-day">Day of Month (1–31)</Label>
        <Input
          id="rec-day"
          type="number"
          min="1"
          max="31"
          value={dayOfMonth}
          onChange={(e) => setDayOfMonth(e.target.value)}
          placeholder="1"
          required
        />
      </div>

      {/* COA */}
      <div className="space-y-1.5">
        <Label>Category (COA)</Label>
        <Select value={coaCode || "__none__"} onValueChange={(v) => setCoaCode(v === "__none__" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select category…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {coaList.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                  <span>{c.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="rec-notes">Notes</Label>
        <Input
          id="rec-notes"
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
          disabled={saving || !accountId || !name}
          className={isEdit ? "" : "ml-auto"}
        >
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Recurring"}
        </Button>
      </div>
    </form>
  );
}
