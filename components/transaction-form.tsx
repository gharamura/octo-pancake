"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
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
import { AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// ───── Ledger form primitives ─────────────────────────────────────────────
// Hairline 1px border · mono · tabular-nums · uppercase labels · red "*"

function LmLabel({
  children,
  required,
  hint,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?:     string;
}) {
  return (
    <div className="mb-1 flex items-baseline gap-2">
      <span className="text-[9px] uppercase tracking-[1.2px] text-[color:var(--color-lm-fg-dim)]">
        {children}
        {required && <span className="ml-0.5 text-[color:var(--color-lm-loss)]">*</span>}
      </span>
      {hint && (
        <span className="ml-auto text-[9px] text-[color:var(--color-lm-fg-ghost)]">{hint}</span>
      )}
    </div>
  );
}

const LM_INPUT_CLS =
  "h-7 w-full rounded-none border border-[color:var(--color-lm-border-2)] bg-transparent px-2.5 font-mono text-[12px] tabular-nums text-[color:var(--color-lm-fg)] placeholder:text-[color:var(--color-lm-fg-dim)] focus-visible:border-[color:var(--color-lm-fg)] focus-visible:ring-0 focus-visible:outline-none";
const LM_SELECT_TRIGGER_CLS =
  "h-7 w-full rounded-none border border-[color:var(--color-lm-border-2)] bg-transparent px-2.5 font-mono text-[12px] text-[color:var(--color-lm-fg)] data-[placeholder]:text-[color:var(--color-lm-fg-dim)] focus:border-[color:var(--color-lm-fg)] focus:ring-0";
const LM_POPOVER_CLS =
  "rounded-none border border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] font-mono text-[11px] text-[color:var(--color-lm-fg)] p-0";
const LM_SELECT_CONTENT_CLS =
  "rounded-none border border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] font-mono text-[11px] text-[color:var(--color-lm-fg)]";

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

type AssetOption = { id: string; name: string; assetClass: string | null; currency: string | null; expirationDate?: string | null; accountId?: string; accountName?: string };

function fmtExpiry(val: string | null | undefined): string | null {
  if (!val) return null;
  const s = val.includes("T") ? val.split("T")[0] : val;
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return null;
  return `${d}/${m}/${y}`;
}

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

  type DuplicateHit = { id: string; recipient: string | null; coaName: string | null; amount: string };
  const [duplicates,        setDuplicates]        = useState<DuplicateHit[]>([]);
  const [dupeChecking,      setDupeChecking]      = useState(false);
  const [dupeConfirmed,     setDupeConfirmed]     = useState(false);

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

  // Debounced duplicate check (create mode only)
  useEffect(() => {
    if (isEdit || !transactionDate || !accountId || !amount) {
      setDuplicates([]);
      setDupeConfirmed(false);
      return;
    }
    setDupeChecking(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ date: transactionDate, accountId, amount });
      fetch(`/api/transactions/check-duplicate?${params}`)
        .then(r => r.json())
        .then(({ duplicates: hits }) => {
          setDuplicates(hits ?? []);
          setDupeConfirmed(false);
        })
        .catch(() => {})
        .finally(() => setDupeChecking(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [isEdit, transactionDate, accountId, amount]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionDate, accountId, amount, coaCode, notes, recipient, assetId, accountingDate, currency, dupeConfirmed, saving]);

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

  const hasDupeBlock = !isEdit && duplicates.length > 0 && !dupeChecking;
  const showAddAnyway = !isEdit && duplicates.length > 0 && !dupeConfirmed;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
      className="flex flex-col gap-3.5 font-mono text-[11px]"
    >
      {/* Conta */}
      <div>
        <LmLabel required>Conta</LmLabel>
        <Select value={accountId} onValueChange={setAccountId} required>
          <SelectTrigger className={LM_SELECT_TRIGGER_CLS}>
            <SelectValue placeholder="selecione…" />
          </SelectTrigger>
          <SelectContent className={LM_SELECT_CONTENT_CLS}>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="flex flex-col">
                  <span>{a.name}</span>
                  <span className="text-[10px] text-[color:var(--color-lm-fg-dim)]">
                    {[a.type, a.institution, a.accountNumber].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data */}
      <div>
        <LmLabel required hint="YYYY-MM-DD">Data</LmLabel>
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
          className={LM_INPUT_CLS}
        />
      </div>

      {/* Valor + Moeda */}
      <div className="flex gap-2.5">
        <div className="flex-[2]">
          <LmLabel required hint="negativo = saída">Valor</LmLabel>
          <div className="flex items-center gap-2 border border-[color:var(--color-lm-border-2)] focus-within:border-[color:var(--color-lm-fg)]">
            <span className="pl-2.5 text-[11px] text-[color:var(--color-lm-fg-dim)]">R$</span>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              required
              className="h-7 flex-1 rounded-none border-0 bg-transparent px-0 text-right font-mono text-[12px] tabular-nums text-[color:var(--color-lm-fg)] placeholder:text-[color:var(--color-lm-fg-dim)] focus-visible:ring-0 focus-visible:outline-none"
            />
          </div>
        </div>
        <div className="w-20 shrink-0">
          <LmLabel>Moeda</LmLabel>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className={LM_SELECT_TRIGGER_CLS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={LM_SELECT_CONTENT_CLS}>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Duplicate warning — hairline pending-amber */}
      {hasDupeBlock && (
        <div className="border border-[color:var(--color-lm-pending)] bg-[rgba(200,156,78,0.06)] p-2.5 text-[10px]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--color-lm-pending)]" />
            <div className="flex-1">
              <div className="mb-1 uppercase tracking-[1px] text-[color:var(--color-lm-pending)]">
                possível duplicata{duplicates.length > 1 ? "s" : ""}
              </div>
              <ul className="space-y-0.5 text-[color:var(--color-lm-fg-muted)]">
                {duplicates.map(d => (
                  <li key={d.id}>
                    {d.recipient ?? "—"}{d.coaName ? ` · ${d.coaName}` : ""} · {d.amount}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Recipient */}
      <div>
        <LmLabel>Recipient</LmLabel>
        <Input
          id="recipient"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="ex: mercado, salário"
          className={LM_INPUT_CLS}
        />
      </div>

      {/* Categoria · COA (combobox) */}
      <div>
        <LmLabel>Categoria · COA</LmLabel>
        <Popover open={coaOpen} onOpenChange={setCoaOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              role="combobox"
              aria-expanded={coaOpen}
              className="flex h-7 w-full items-center justify-between border border-[color:var(--color-lm-border-2)] bg-transparent px-2.5 font-mono text-[12px] text-[color:var(--color-lm-fg)] hover:border-[color:var(--color-lm-fg-muted)] data-[state=open]:border-[color:var(--color-lm-fg)]"
            >
              <span className="truncate text-left">
                {selectedCoa
                  ? <>
                      <span className="mr-1.5 text-[10px] text-[color:var(--color-lm-fg-dim)]">{selectedCoa.code}</span>
                      {selectedCoa.name}
                    </>
                  : <span className="text-[color:var(--color-lm-fg-dim)]">— nenhum —</span>}
              </span>
              <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 text-[color:var(--color-lm-fg-dim)]" />
            </button>
          </PopoverTrigger>
          <PopoverContent className={`w-[--radix-popover-trigger-width] ${LM_POPOVER_CLS}`} align="start">
            <Command className="bg-transparent">
              <CommandInput placeholder="buscar por código ou nome…" />
              <CommandList>
                <CommandEmpty>Nenhuma categoria.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__none__"
                    onSelect={() => { setCoaCode("__none__"); setCoaOpen(false); }}
                  >
                    <Check className={`mr-2 h-3 w-3 ${coaCode === "__none__" ? "opacity-100" : "opacity-0"}`} />
                    <span className="italic text-[color:var(--color-lm-fg-muted)]">— nenhum —</span>
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
                      <Check className={`mr-2 h-3 w-3 ${coaCode === c.code ? "opacity-100" : "opacity-0"}`} />
                      <span className="mr-2 text-[10px] text-[color:var(--color-lm-fg-dim)]">{c.code}</span>
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Asset (conditional) */}
      {coaCode !== "__none__" && ASSET_COA_CODES.has(coaCode) && (
        <div>
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-[9px] uppercase tracking-[1.2px] text-[color:var(--color-lm-fg-dim)]">Ativo</span>
            <label className="ml-auto flex cursor-pointer select-none items-center gap-1.5 text-[9px] uppercase tracking-[1px] text-[color:var(--color-lm-fg-muted)]">
              <input
                type="checkbox"
                checked={showAllAssets}
                onChange={(e) => setShowAllAssets(e.target.checked)}
                className="h-3 w-3 accent-[color:var(--color-lm-fg)]"
              />
              todas as contas
            </label>
          </div>
          <Select value={assetId ?? "__none__"} onValueChange={(v) => setAssetId(v === "__none__" ? null : v)}>
            <SelectTrigger className={LM_SELECT_TRIGGER_CLS}>
              <SelectValue placeholder="selecione ativo…" />
            </SelectTrigger>
            <SelectContent className={LM_SELECT_CONTENT_CLS}>
              <SelectItem value="__none__">
                <span className="italic text-[color:var(--color-lm-fg-muted)]">— nenhum —</span>
              </SelectItem>
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
                      <SelectLabel className="text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-fg-dim)]">
                        {accountName}
                      </SelectLabel>
                      {items.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex flex-col">
                            <span>{a.name}</span>
                            <span className="text-[10px] text-[color:var(--color-lm-fg-dim)]">
                              {[
                                a.assetClass?.replace(/_/g, " "),
                                a.currency && a.currency !== "BRL" ? a.currency : null,
                                fmtExpiry(a.expirationDate) ? `exp. ${fmtExpiry(a.expirationDate)}` : null,
                              ].filter(Boolean).join(" · ")}
                            </span>
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
                      <span className="text-[10px] text-[color:var(--color-lm-fg-dim)]">
                        {[
                          a.assetClass?.replace(/_/g, " "),
                          a.currency && a.currency !== "BRL" ? a.currency : null,
                          fmtExpiry(a.expirationDate) ? `exp. ${fmtExpiry(a.expirationDate)}` : null,
                        ].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Mês contábil */}
      <div>
        <LmLabel>Mês contábil</LmLabel>
        <Input
          id="accountingDate"
          type="month"
          value={accountingDate.slice(0, 7)}
          onChange={(e) =>
            setAccountingDate(e.target.value ? `${e.target.value}-01` : "")
          }
          className={LM_INPUT_CLS}
        />
      </div>

      {/* Notas */}
      <div>
        <LmLabel>Notas</LmLabel>
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="opcional"
          className={LM_INPUT_CLS}
        />
      </div>

      {/* Status bar — ERR/OK + keyboard hints */}
      <div
        className="-mx-5 mt-2 flex min-h-6 items-center gap-2.5 border-t border-[color:var(--color-lm-border-2)] px-5 py-1.5 text-[10px] text-[color:var(--color-lm-fg-dim)]"
        style={{ background: error ? "rgba(200,78,78,0.08)" : "transparent" }}
      >
        {error ? (
          <>
            <span className="text-[color:var(--color-lm-loss)]">ERR</span>
            <span className="text-[color:var(--color-lm-loss)]">{error}</span>
          </>
        ) : dupeChecking ? (
          <span>verificando duplicatas…</span>
        ) : (
          <span>pronto.</span>
        )}
        <span className="flex-1" />
        <span>
          <kbd className="mr-1 border border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] px-1 text-[9px]">Tab</kbd>
          <span className="text-[color:var(--color-lm-fg-ghost)]">próximo</span>
        </span>
        <span>
          <kbd className="mr-1 border border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] px-1 text-[9px]">⌘⏎</kbd>
          <span className="text-[color:var(--color-lm-fg-ghost)]">salvar</span>
        </span>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2">
        {isEdit && (
          confirmDelete ? (
            <>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="h-8 border border-[color:var(--color-lm-loss)] bg-[rgba(200,78,78,0.08)] px-3.5 font-mono text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-loss)] disabled:opacity-50"
              >
                {deleting ? "deletando…" : "confirmar delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-8 border border-[color:var(--color-lm-border-2)] px-3 font-mono text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-fg-muted)]"
              >
                cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="h-8 border border-[color:var(--color-lm-border-2)] px-3.5 font-mono text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-loss)] hover:border-[color:var(--color-lm-loss)]"
            >
              deletar
            </button>
          )
        )}

        {showAddAnyway ? (
          <button
            type="button"
            disabled={saving || !accountId}
            className="ml-auto flex h-8 items-center gap-2 border border-[color:var(--color-lm-pending)] bg-[rgba(200,156,78,0.08)] px-3.5 font-mono text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-pending)] disabled:opacity-50"
            onClick={() => setDupeConfirmed(true)}
          >
            adicionar mesmo assim
          </button>
        ) : (
          <button
            type="submit"
            disabled={saving || !accountId}
            className="ml-auto flex h-8 items-center justify-center gap-2 bg-[color:var(--color-lm-fg)] px-5 font-mono text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-bg)] disabled:opacity-40"
          >
            {saving ? "salvando…" : isEdit ? "salvar" : "adicionar"}
            <kbd className="border border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] px-1 text-[9px] text-[color:var(--color-lm-fg-muted)]">⏎</kbd>
          </button>
        )}
      </div>
    </form>
  );
}
