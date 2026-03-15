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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FinancialAccount, CoaAccount } from "@/lib/db/schema";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  currency: string;
  recipient: string | null;
  notes: string | null;
  transferId: string | null;
  recipientId: string | null;
  accountName: string | null;
  coaName: string | null;
  linkedRecipientName: string | null;
  aliasRecipientId: string | null;
  aliasRecipientName: string | null;
  assetId: string | null;
  assetName: string | null;
}

const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "ARS", "CLP", "COP", "MXN", "UYU"];

const ASSET_COA_CODES = new Set(["1060", "4110", "4210"]);

type AssetOption = { id: string; name: string; assetClass: string | null; currency: string | null; accountId?: string; accountName?: string };

interface TransactionFormProps {
  transaction?: TransactionRow;
  onSuccess:   () => void;
  onCreated?:  () => void;
  /** Called after a successful edit save — preferred over onSuccess for edit. */
  onSaved?:    (id: string) => void;
  /** Called after a successful delete — preferred over onSuccess for delete. */
  onDeleted?:  (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionForm({ transaction, onSuccess, onCreated, onSaved, onDeleted }: TransactionFormProps) {
  const isEdit = !!transaction;
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [transactionDate, setTransactionDate] = useState(
    toDateInput(transaction?.transactionDate)
  );
  const [accountingDate, setAccountingDate] = useState(
    toDateInput(transaction?.accountingDate)
  );
  const [accountId,  setAccountId]  = useState(transaction?.accountId  ?? "");
  const [coaCode,    setCoaCode]    = useState(transaction?.coaCode    ?? "__none__");
  const [amount,     setAmount]     = useState(transaction?.amount     ?? "");
  const [currency,   setCurrency]   = useState(transaction?.currency   ?? "BRL");
  const [recipient,  setRecipient]  = useState(transaction?.recipient  ?? "");
  const [notes,      setNotes]      = useState(transaction?.notes      ?? "");

  const [assetId,       setAssetId]       = useState<string | null>(transaction?.assetId ?? null);
  const [assetList,     setAssetList]     = useState<AssetOption[]>([]);
  const [showAllAssets, setShowAllAssets] = useState(false);

  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [coaList,  setCoaList]  = useState<CoaAccount[]>([]);


  const [coaOpen, setCoaOpen] = useState(false);
  const selectedCoa = useMemo(
    () => coaCode !== "__none__" ? coaList.find((c) => c.code === coaCode) ?? null : null,
    [coaCode, coaList]
  );

  // Accounts whose code appears as parentCode of another account are group
  // accounts — they cannot be directly assigned to a transaction.
  const leafCoaList = useMemo(() => {
    const parentCodes = new Set(coaList.map((c) => c.parentCode).filter(Boolean));
    return coaList.filter((c) => !parentCodes.has(c.code));
  }, [coaList]);

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

  useEffect(() => {
    const isAssetCoa = coaCode !== "__none__" && ASSET_COA_CODES.has(coaCode);
    if (!isAssetCoa) {
      setAssetList([]);
      setAssetId(null);
      return;
    }
    if (!showAllAssets && !accountId) {
      setAssetList([]);
      return;
    }
    const params = new URLSearchParams({ includeAll: "true" });
    if (!showAllAssets && accountId) params.set("accountId", accountId);
    fetch(`/api/assets?${params}`)
      .then((r) => r.json())
      .then((data: AssetOption[]) => setAssetList(data))
      .catch(() => {});
  }, [accountId, coaCode, showAllAssets]);

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    try {
      const isAssetCoa = coaCode !== "__none__" && ASSET_COA_CODES.has(coaCode);
      const body = {
        transactionDate,
        accountingDate: accountingDate || null,
        accountId,
        coaCode: coaCode === "__none__" ? null : coaCode || null,
        amount,
        currency,
        recipient: recipient || null,
        notes: notes || null,
        assetId: isAssetCoa ? (assetId || null) : null,
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

      if (isEdit) {
        onSaved ? onSaved(transaction.id) : onSuccess();
      } else {
        setTransactionDate("");
        setAccountingDate("");
        setCoaCode("__none__");
        setAmount("");
        setRecipient("");
        setNotes("");
        setAssetId(null);
        onCreated ? onCreated() : onSuccess();
        setTimeout(() => dateInputRef.current?.focus(), 0);
      }
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
      onDeleted ? onDeleted(transaction.id) : onSuccess();
    } catch {
      setError("Something went wrong.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-5">
      <div className="space-y-1.5">
        <Label>Account</Label>
        <Select value={accountId} onValueChange={setAccountId} required>
          <SelectTrigger>
            <SelectValue placeholder="Select account…" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="flex flex-col">
                  <span>{a.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[a.type, a.institution, a.accountNumber].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transactionDate">Transaction Date</Label>
        <Input
          ref={dateInputRef}
          id="transactionDate"
          type="date"
          value={transactionDate}
          onChange={(e) => {
            const v = e.target.value;
            setTransactionDate(v);
            if (v) setAccountingDate(`${v.slice(0, 7)}-01`);
          }}
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

      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
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
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">Use a negative value for expenses.</p>

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

      <div className="space-y-1.5">
        <Label>COA Account</Label>
        <Popover open={coaOpen} onOpenChange={setCoaOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={coaOpen}
              className="w-full justify-between font-normal"
            >
              <span className="truncate">
                {selectedCoa ? `${selectedCoa.code} · ${selectedCoa.name}` : "— None —"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search by code or name…" />
              <CommandList>
                <CommandEmpty>No account found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__none__"
                    onSelect={() => { setCoaCode("__none__"); setCoaOpen(false); }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${coaCode === "__none__" ? "opacity-100" : "opacity-0"}`} />
                    — None —
                  </CommandItem>
                  {leafCoaList.map((c) => (
                    <CommandItem
                      key={c.code}
                      value={`${c.code} ${c.name}`}
                      onSelect={() => {
                        setCoaCode(c.code);
                        setCoaOpen(false);
                        if (amount) {
                          const val = parseFloat(amount);
                          if (!isNaN(val) && val !== 0) {
                            if (c.type === "expense" && val > 0) setAmount(String(-val));
                            if (c.type === "income"  && val < 0) setAmount(String(-val));
                          }
                        }
                      }}
                    >
                      <Check className={`mr-2 h-4 w-4 ${coaCode === c.code ? "opacity-100" : "opacity-0"}`} />
                      {c.code} · {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {coaCode !== "__none__" && ASSET_COA_CODES.has(coaCode) && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Asset</Label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAllAssets}
                onChange={(e) => setShowAllAssets(e.target.checked)}
                className="rounded border-muted-foreground/40"
              />
              All accounts
            </label>
          </div>
          <Select value={assetId ?? "__none__"} onValueChange={(v) => setAssetId(v === "__none__" ? null : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select asset…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None —</SelectItem>
              {showAllAssets ? (
                (() => {
                  const grouped = new Map<string, AssetOption[]>();
                  for (const a of assetList) {
                    const key = a.accountName ?? a.accountId ?? "Other";
                    if (!grouped.has(key)) grouped.set(key, []);
                    grouped.get(key)!.push(a);
                  }
                  return Array.from(grouped.entries()).map(([accountName, items]) => (
                    <SelectGroup key={accountName}>
                      <SelectLabel className="text-xs text-muted-foreground font-semibold">
                        {accountName}
                      </SelectLabel>
                      {items.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex flex-col">
                            <span>{a.name}</span>
                            {a.assetClass && (
                              <span className="text-xs text-muted-foreground">
                                {a.assetClass.replace(/_/g, " ")}
                                {a.currency && a.currency !== "BRL" && ` · ${a.currency}`}
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ));
                })()
              ) : (
                assetList.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex flex-col">
                      <span>{a.name}</span>
                      {a.assetClass && (
                        <span className="text-xs text-muted-foreground">
                          {a.assetClass.replace(/_/g, " ")}
                          {a.currency && a.currency !== "BRL" && ` · ${a.currency}`}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

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
