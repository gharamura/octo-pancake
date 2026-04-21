"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionForm, type TransactionRow } from "@/components/transaction-form";
import { LinkTransferDialog, UnlinkTransferDialog } from "@/components/link-transfer-dialog";
import { LinkRecipientDialog } from "@/components/link-recipient-dialog";
import { SuggestCategoriesSheet } from "@/components/suggest-categories-sheet";
import type { RecipientDetail } from "@/lib/repositories/recipient.repository";
import {
  ArrowUpDown,
  ChevronDown,
  Link2,
  ListFilter,
  Package,
  PackageOpen,
  Pencil,
  Sparkles,
  Unlink2,
  UserRound,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

const TRANSFER_CODES = new Set(["3110", "3120"]);
const ASSET_COA_CODES = new Set(["1060", "4110", "4210"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ledger date: YYYY.MM.DD */
function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const s = value.slice(0, 10);
  const [y, m, d] = s.split("-");
  return `${y}.${m}.${d}`;
}

function toISO(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function fmtBRL(val: number): string {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const DATE_PRESETS = [
  { label: "Últimos 30 dias", days: 30 },
  { label: "Últimos 60 dias", days: 60 },
  { label: "Últimos 90 dias", days: 90 },
] as const;

// ---------------------------------------------------------------------------
// Filter buttons — styled for Ledger (hairline, mono, uppercase)
// ---------------------------------------------------------------------------

function LmFilterButton({
  active,
  children,
  onClick,
  variant = "default",
}: {
  active?:  boolean;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary";
}) {
  const bg = variant === "primary"
    ? "bg-[color:var(--color-lm-fg)] text-[color:var(--color-lm-bg)]"
    : active
      ? "bg-[rgba(255,255,255,0.04)] text-[color:var(--color-lm-fg)]"
      : "bg-transparent text-[color:var(--color-lm-fg-muted)] hover:text-[color:var(--color-lm-fg)]";
  return (
    <button
      onClick={onClick}
      className={`h-7 whitespace-nowrap border border-[color:var(--color-lm-border-2)] px-2.5 font-mono text-[10px] tracking-[1px] uppercase ${bg}`}
    >
      {children}
    </button>
  );
}

function MultiFilter({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label:    string;
  options:  { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear:  () => void;
}) {
  const active = selected.length > 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex h-7 items-center gap-1.5 whitespace-nowrap border border-[color:var(--color-lm-border-2)] px-2.5 font-mono text-[10px] tracking-[1px] uppercase ${
            active
              ? "bg-[rgba(255,255,255,0.04)] text-[color:var(--color-lm-fg)]"
              : "text-[color:var(--color-lm-fg-muted)] hover:text-[color:var(--color-lm-fg)]"
          }`}
        >
          {active
            ? <ListFilter className="h-3 w-3 text-[color:var(--color-lm-fg)]" />
            : <ChevronDown className="h-3 w-3 opacity-50" />}
          {label}
          {active && (
            <span className="bg-[color:var(--color-lm-fg)] px-1 text-[9px] font-semibold text-[color:var(--color-lm-bg)] leading-[14px]">
              {selected.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px] max-h-72 overflow-y-auto border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] font-mono text-xs">
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={selected.includes(opt.value)}
            onCheckedChange={() => onToggle(opt.value)}
            onSelect={(e) => e.preventDefault()}
            className="text-[color:var(--color-lm-fg)]"
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
        {active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-fg-muted)]"
              onSelect={onClear}
            >
              Limpar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DateRangeFilter({
  label,
  from,
  to,
  onFrom,
  onTo,
  onClear,
}: {
  label: string;
  from:  string;
  to:    string;
  onFrom: (v: string) => void;
  onTo:   (v: string) => void;
  onClear: () => void;
}) {
  const active = !!from || !!to;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex h-7 items-center gap-1.5 whitespace-nowrap border border-[color:var(--color-lm-border-2)] px-2.5 font-mono text-[10px] tracking-[1px] uppercase ${
            active
              ? "bg-[rgba(255,255,255,0.04)] text-[color:var(--color-lm-fg)]"
              : "text-[color:var(--color-lm-fg-muted)] hover:text-[color:var(--color-lm-fg)]"
          }`}
        >
          {label}
          {active && <span className="h-1.5 w-1.5 bg-[color:var(--color-lm-fg)]" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-2.5 border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] p-3 font-mono">
        <p className="text-[9px] tracking-[1.2px] uppercase text-[color:var(--color-lm-fg-dim)]">
          {label}
        </p>

        <div className="flex flex-col gap-1">
          {DATE_PRESETS.map(({ label: pl, days }) => (
            <button
              key={days}
              className="rounded-none px-2 py-1 text-left text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-fg-muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--color-lm-fg)]"
              onClick={() => { onFrom(daysAgo(days)); onTo(today()); }}
            >
              {pl}
            </button>
          ))}
        </div>

        <div className="space-y-2 border-t border-[color:var(--color-lm-border)] pt-2">
          <div className="space-y-1">
            <Label className="text-[9px] uppercase tracking-[1.2px] text-[color:var(--color-lm-fg-dim)]">De</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => onFrom(e.target.value)}
              className="h-7 border-[color:var(--color-lm-border-2)] bg-transparent font-mono text-[11px] text-[color:var(--color-lm-fg)]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] uppercase tracking-[1.2px] text-[color:var(--color-lm-fg-dim)]">Até</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => onTo(e.target.value)}
              className="h-7 border-[color:var(--color-lm-border-2)] bg-transparent font-mono text-[11px] text-[color:var(--color-lm-fg)]"
            />
          </div>
        </div>

        {active && (
          <button
            className="h-7 w-full border border-[color:var(--color-lm-border-2)] text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-fg-muted)] hover:text-[color:var(--color-lm-fg)]"
            onClick={onClear}
          >
            Limpar
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function MonthFilter({
  label,
  value,
  onChange,
  onClear,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onClear:  () => void;
}) {
  const active = !!value;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex h-7 items-center gap-1.5 whitespace-nowrap border border-[color:var(--color-lm-border-2)] px-2.5 font-mono text-[10px] tracking-[1px] uppercase ${
            active
              ? "bg-[rgba(255,255,255,0.04)] text-[color:var(--color-lm-fg)]"
              : "text-[color:var(--color-lm-fg-muted)] hover:text-[color:var(--color-lm-fg)]"
          }`}
        >
          {label}
          {active && <span className="h-1.5 w-1.5 bg-[color:var(--color-lm-fg)]" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-2.5 border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] p-3 font-mono">
        <p className="text-[9px] tracking-[1.2px] uppercase text-[color:var(--color-lm-fg-dim)]">
          {label}
        </p>
        <div className="space-y-1">
          <Label className="text-[9px] uppercase tracking-[1.2px] text-[color:var(--color-lm-fg-dim)]">Mês</Label>
          <Input
            type="month"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 border-[color:var(--color-lm-border-2)] bg-transparent font-mono text-[11px] text-[color:var(--color-lm-fg)]"
          />
        </div>
        {active && (
          <button
            className="h-7 w-full border border-[color:var(--color-lm-border-2)] text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-fg-muted)] hover:text-[color:var(--color-lm-fg)]"
            onClick={onClear}
          >
            Limpar
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Bulk edit bar
// ---------------------------------------------------------------------------

type CoaOption = { code: string; name: string };
type RecipientOption = { id: string; name: string };

function BulkEditBar({
  selectedCount,
  coaOptions,
  recipients,
  onApply,
  onClear,
}: {
  selectedCount: number;
  coaOptions:   CoaOption[];
  recipients:   RecipientOption[];
  onApply: (data: { coaCode?: string | null; accountingDate?: string | null; recipientId?: string | null }) => Promise<void>;
  onClear: () => void;
}) {
  const [coaCode,         setCoaCode]         = useState("");
  const [accountingMonth, setAccountingMonth] = useState("");
  const [recipientId,     setRecipientId]     = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientOpen,   setRecipientOpen]   = useState(false);
  const [applying,        setApplying]        = useState(false);

  const selectedRecipientName = recipients.find((r) => r.id === recipientId)?.name;
  const hasChanges = !!coaCode || !!accountingMonth || !!recipientId;

  const handleApply = async () => {
    if (!hasChanges) return;
    setApplying(true);
    const data: { coaCode?: string | null; accountingDate?: string | null; recipientId?: string | null } = {};
    if (coaCode)         data.coaCode        = coaCode     === "__clear__" ? null : coaCode;
    if (accountingMonth) data.accountingDate = `${accountingMonth}-01`;
    if (recipientId)     data.recipientId    = recipientId === "__clear__" ? null : recipientId;
    await onApply(data);
    setApplying(false);
    setCoaCode("");
    setAccountingMonth("");
    setRecipientId("");
    setRecipientSearch("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-y border-[color:var(--color-lm-border-2)] bg-[rgba(255,255,255,0.02)] px-3.5 py-2 font-mono text-[11px]">
      <span className="text-[color:var(--color-lm-fg)]">
        <span className="text-[color:var(--color-lm-fg-muted)]">sel</span> {selectedCount}
      </span>
      <span className="text-[color:var(--color-lm-fg-dim)]">·</span>

      <Select value={coaCode} onValueChange={setCoaCode}>
        <SelectTrigger className="h-7 w-60 border-[color:var(--color-lm-border-2)] bg-transparent text-[11px]">
          <SelectValue placeholder="set coa…" />
        </SelectTrigger>
        <SelectContent className="border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] font-mono">
          <SelectItem value="__clear__">
            <span className="italic text-[color:var(--color-lm-fg-muted)]">— limpar coa —</span>
          </SelectItem>
          {coaOptions.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              <span className="font-mono text-[10px] text-[color:var(--color-lm-fg-muted)] mr-1.5">{c.code}</span>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={recipientOpen} onOpenChange={setRecipientOpen}>
        <PopoverTrigger asChild>
          <button className="flex h-7 w-52 items-center justify-between border border-[color:var(--color-lm-border-2)] bg-transparent px-2.5 text-[11px]">
            <span className={selectedRecipientName ? "text-[color:var(--color-lm-fg)]" : "text-[color:var(--color-lm-fg-muted)]"}>
              {recipientId === "__clear__"
                ? <span className="italic text-[color:var(--color-lm-fg-muted)]">— limpar recipient —</span>
                : selectedRecipientName ?? "set recipient…"}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] p-0 font-mono" align="start">
          <Command className="bg-transparent">
            <CommandInput
              placeholder="Buscar recipient…"
              value={recipientSearch}
              onValueChange={setRecipientSearch}
            />
            <CommandList>
              <CommandEmpty>Nenhum recipient.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => { setRecipientId("__clear__"); setRecipientOpen(false); }}
                >
                  <span className="italic text-[11px] text-[color:var(--color-lm-fg-muted)]">— limpar recipient —</span>
                </CommandItem>
                {recipients.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={r.name}
                    onSelect={() => { setRecipientId(r.id); setRecipientOpen(false); }}
                  >
                    {r.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        type="month"
        value={accountingMonth}
        onChange={(e) => setAccountingMonth(e.target.value)}
        className="h-7 w-40 border-[color:var(--color-lm-border-2)] bg-transparent text-[11px]"
        placeholder="mês contábil"
      />

      <button
        onClick={handleApply}
        disabled={!hasChanges || applying}
        className="h-7 bg-[color:var(--color-lm-fg)] px-3 font-mono text-[10px] tracking-[1px] uppercase text-[color:var(--color-lm-bg)] disabled:opacity-40"
      >
        {applying ? "aplicando…" : "aplicar"}
      </button>

      <button
        onClick={onClear}
        className="ml-auto flex h-7 items-center gap-1 border border-[color:var(--color-lm-border-2)] px-2.5 text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-fg-muted)] hover:text-[color:var(--color-lm-fg)]"
      >
        <X className="h-3 w-3" /> limpar seleção
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI band
// ---------------------------------------------------------------------------

function LmKpi({
  label,
  value,
  currency = true,
  negative,
  sub,
  emphasis,
}: {
  label:    string;
  value:    number | string;
  currency?: boolean;
  negative?: boolean;
  sub?:      string;
  emphasis?: boolean;
}) {
  const color = negative
    ? "var(--color-lm-loss)"
    : "var(--color-lm-fg)";
  return (
    <div className="min-w-0 border-r border-[color:var(--color-lm-border)] px-3.5 py-3 last:border-r-0">
      <div className="lm-label-upper mb-1.5">{label}</div>
      <div
        className="font-mono tabular-nums tracking-[-0.2px]"
        style={{ color, fontSize: emphasis ? 18 : 15 }}
      >
        {currency && typeof value === "number" ? (
          <>
            {negative ? "−" : " "}
            <span className="mr-[3px] text-[11px] text-[color:var(--color-lm-fg-dim)]">R$</span>
            {fmtBRL(Math.abs(value))}
          </>
        ) : (
          <>{value}</>
        )}
      </div>
      {sub && <div className="mt-1 font-mono text-[9px] text-[color:var(--color-lm-fg-dim)]">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sheet state
// ---------------------------------------------------------------------------

interface SheetState {
  open: boolean;
  mode: "create" | "edit";
  transaction?: TransactionRow;
}

// ---------------------------------------------------------------------------
// Transaction row (CSS-grid, memoized)
// ---------------------------------------------------------------------------

// chk(28) Data(88) Recipient(1fr) Notes(220) Conta(120) Cat·COA(140) CCY(44)
// Débito(110) Crédito(110) Link(32) Stat(44) Edit(32)
const ROW_TEMPLATE =
  "28px 88px minmax(160px, 1fr) 220px 120px 140px 44px 110px 110px 32px 44px 32px";

type TxRowProps = {
  row:          TransactionRow;
  isSelected:   boolean;
  isNewDay:     boolean;
  onToggle:     (id: string) => void;
  onEdit:       (t: TransactionRow) => void;
  onFlipSign:   (t: TransactionRow) => void;
  onLink:       (t: TransactionRow) => void;
  onUnlink:     (t: TransactionRow) => void;
  onLinkRecipient: (t: TransactionRow) => void;
  stripe:       boolean;
};

const TxRow = memo(
  function TxRow({
    row: t,
    isSelected,
    isNewDay,
    onToggle,
    onEdit,
    onFlipSign,
    onLink,
    onUnlink,
    onLinkRecipient,
    stripe,
  }: TxRowProps) {
    const amountNum = parseFloat(t.amount ?? "0");
    const isDebit   = amountNum < 0;
    const abs       = fmtBRL(Math.abs(amountNum));
    const currency  = t.currency ?? "BRL";
    const isForeign = currency !== "BRL";

    const dateStr = formatDate(t.transactionDate);

    const directLinked = !!t.recipientId;
    const aliasLinked  = !directLinked && !!t.aliasRecipientId;

    const isTransferCoa = TRANSFER_CODES.has(t.coaCode ?? "");
    const isAssetCoa    = ASSET_COA_CODES.has(t.coaCode ?? "");

    return (
      <div
        className="group grid items-center border-b border-[color:var(--color-lm-border)] px-3.5 py-1 text-[11px]"
        style={{
          gridTemplateColumns: ROW_TEMPLATE,
          gap: 8,
          background: stripe ? "rgba(255,255,255,0.012)" : "transparent",
        }}
      >
        {/* checkbox */}
        <div>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(t.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5 cursor-pointer border-[color:var(--color-lm-border-2)] accent-[color:var(--color-lm-fg)]"
          />
        </div>

        {/* date */}
        <div
          className="font-mono tabular-nums"
          style={{ color: isNewDay ? "var(--color-lm-fg-muted)" : "var(--color-lm-fg-ghost)" }}
        >
          {isNewDay ? dateStr : "·"}
        </div>

        {/* recipient */}
        <div className="flex min-w-0 items-center gap-1">
          <span
            className="truncate"
            style={{ color: directLinked ? "var(--color-lm-fg)" : "var(--color-lm-fg-muted)" }}
          >
            {directLinked
              ? (t.linkedRecipientName ?? t.recipient ?? "—")
              : (t.recipient ?? "—")}
          </span>
          <button
            className={`text-[color:var(--color-lm-fg-ghost)] hover:text-[color:var(--color-lm-fg)] ${
              directLinked ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-60"
            }`}
            onClick={(e) => { e.stopPropagation(); onLinkRecipient(t); }}
            title={directLinked ? "Trocar recipient" : "Linkar recipient"}
          >
            <UserRound className="h-3 w-3" />
          </button>
          {aliasLinked && (
            <span className="truncate text-[9px] text-[color:var(--color-lm-pending)]">
              {t.aliasRecipientName}
            </span>
          )}
        </div>

        {/* notes / description */}
        <div className="min-w-0 truncate text-[color:var(--color-lm-fg-muted)]">
          {t.notes ?? "—"}
        </div>

        {/* account */}
        <div className="min-w-0 truncate text-[color:var(--color-lm-fg-muted)]">
          {t.accountName ?? "—"}
        </div>

        {/* coa */}
        <div className="min-w-0 truncate text-[color:var(--color-lm-fg-muted)]">
          {t.coaCode ? (
            <>
              <span className="mr-1.5 text-[9px] text-[color:var(--color-lm-fg-dim)]">{t.coaCode}</span>
              {t.coaName}
            </>
          ) : <span className="text-[color:var(--color-lm-fg-ghost)]">—</span>}
        </div>

        {/* CCY — foreign currencies highlighted pending-amber */}
        <div
          className="text-right text-[9px] tabular-nums"
          style={{ color: isForeign ? "var(--color-lm-pending)" : "var(--color-lm-fg-dim)" }}
        >
          {currency}
        </div>

        {/* Débito */}
        <div
          className="text-right tabular-nums"
          style={{
            color:      isDebit ? "var(--color-lm-loss)"       : "var(--color-lm-fg-ghost)",
            background: isDebit ? "var(--color-lm-loss-soft)" : "transparent",
            padding:    isDebit ? "2px 4px" : 0,
            margin:     isDebit ? "-2px 0"  : 0,
          }}
        >
          {isDebit ? abs : "—"}
        </div>

        {/* Crédito */}
        <div
          className="flex items-center justify-end gap-1 tabular-nums"
          style={{
            color:      !isDebit ? "var(--color-lm-gain)"      : "var(--color-lm-fg-ghost)",
            background: !isDebit ? "var(--color-lm-gain-soft)" : "transparent",
            padding:    !isDebit ? "2px 4px" : 0,
            margin:     !isDebit ? "-2px 0"  : 0,
          }}
        >
          <span>{!isDebit ? abs : "—"}</span>
          <button
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-[color:var(--color-lm-fg-dim)] hover:text-[color:var(--color-lm-fg)]"
            onClick={(e) => { e.stopPropagation(); onFlipSign(t); }}
            title="Inverter sinal"
          >
            <ArrowUpDown className="h-3 w-3" />
          </button>
        </div>

        {/* link indicator (transfer / asset) */}
        <div className="flex items-center justify-center">
          {isTransferCoa && (
            t.transferId ? (
              <button
                title="Transferência linkada · desvincular"
                className="text-[color:var(--color-lm-gain)]"
                onClick={(e) => { e.stopPropagation(); onUnlink(t); }}
              >
                <Link2 className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                title="Transferência órfã · linkar"
                className="text-[color:var(--color-lm-pending)]"
                onClick={(e) => { e.stopPropagation(); onLink(t); }}
              >
                <Unlink2 className="h-3.5 w-3.5" />
              </button>
            )
          )}
          {isAssetCoa && (
            t.assetId ? (
              <span className="text-[color:var(--color-lm-gain)]" title={t.assetName ?? "Ativo linkado"}>
                <Package className="h-3.5 w-3.5" />
              </span>
            ) : (
              <button
                title="Ativo órfão · editar para linkar"
                className="text-[color:var(--color-lm-pending)]"
                onClick={(e) => { e.stopPropagation(); onEdit(t); }}
              >
                <PackageOpen className="h-3.5 w-3.5" />
              </button>
            )
          )}
        </div>

        {/* status */}
        <div className="flex justify-end">
          {!t.coaCode ? (
            <span className="border border-[color:var(--color-lm-pending)] px-[3px] text-[9px] tracking-[0.5px] text-[color:var(--color-lm-pending)]">
              PEND
            </span>
          ) : (
            <span className="text-[9px] text-[color:var(--color-lm-fg-dim)]">OK</span>
          )}
        </div>

        {/* edit */}
        <div className="flex justify-end">
          <button
            className="text-[color:var(--color-lm-fg-ghost)] hover:text-[color:var(--color-lm-fg)]"
            onClick={(e) => { e.stopPropagation(); onEdit(t); }}
            title="Editar"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.row        === next.row &&
    prev.isSelected === next.isSelected &&
    prev.isNewDay   === next.isNewDay &&
    prev.stripe     === next.stripe &&
    prev.onToggle   === next.onToggle &&
    prev.onEdit     === next.onEdit &&
    prev.onFlipSign === next.onFlipSign &&
    prev.onLink     === next.onLink &&
    prev.onUnlink   === next.onUnlink &&
    prev.onLinkRecipient === next.onLinkRecipient
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TransactionTableProps {
  initialCoa?:       string;
  initialFrom?:      string;
  initialTo?:        string;
  initialAccFrom?:   string;
  initialAccTo?:     string;
  initialRecipient?: string;
}

export function TransactionTable({ initialCoa, initialFrom, initialTo, initialAccFrom, initialAccTo, initialRecipient }: TransactionTableProps = {}) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [sheet, setSheet]               = useState<SheetState>({ open: false, mode: "create" });

  // ── Filter state ─────────────────────────────────────────────────────────
  const [filterAccounts,  setFilterAccounts]  = useState<string[]>([]);
  const [filterCoa,       setFilterCoa]       = useState<string[]>(() => initialCoa ? [initialCoa] : []);
  const [filterRecipient, setFilterRecipient] = useState(initialRecipient ?? "");
  const [txFrom,  setTxFrom]  = useState(() => (initialAccFrom || initialRecipient) ? (initialFrom ?? "") : (initialFrom ?? daysAgo(30)));
  const [txTo,    setTxTo]    = useState(() => (initialAccTo   || initialRecipient) ? (initialTo   ?? "") : (initialTo   ?? today()));
  const [accMonth, setAccMonth] = useState(() => initialAccFrom?.slice(0, 7) ?? "");
  const [filterOrphans,        setFilterOrphans]        = useState(false);
  const [filterOrphanAssets,   setFilterOrphanAssets]   = useState(false);
  const [filterUncategorized,  setFilterUncategorized]  = useState(false);

  // ── Draft filter state (pending until Apply is clicked) ────────────────────
  const [draftFilterAccounts,  setDraftFilterAccounts]  = useState<string[]>([]);
  const [draftFilterCoa,       setDraftFilterCoa]       = useState<string[]>(() => initialCoa ? [initialCoa] : []);
  const [draftFilterRecipient, setDraftFilterRecipient] = useState(initialRecipient ?? "");
  const [draftTxFrom,  setDraftTxFrom]  = useState(() => (initialAccFrom || initialRecipient) ? (initialFrom ?? "") : (initialFrom ?? daysAgo(30)));
  const [draftTxTo,    setDraftTxTo]    = useState(() => (initialAccTo   || initialRecipient) ? (initialTo   ?? "") : (initialTo   ?? today()));
  const [draftAccMonth, setDraftAccMonth] = useState(() => initialAccFrom?.slice(0, 7) ?? "");

  const [linkDialog,   setLinkDialog]   = useState<{ open: boolean; transaction: TransactionRow | null }>({ open: false, transaction: null });
  const [unlinkDialog, setUnlinkDialog] = useState<{ open: boolean; transaction: TransactionRow | null }>({ open: false, transaction: null });

  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [allCoaOptions, setAllCoaOptions] = useState<CoaOption[]>([]);

  const [linkRecipientDialog, setLinkRecipientDialog] = useState<{
    open: boolean; transaction: TransactionRow | null;
  }>({ open: false, transaction: null });
  const [allRecipients, setAllRecipients] = useState<RecipientDetail[]>([]);

  const [suggestSheet, setSuggestSheet] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchTransactions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (txFrom) params.set("from", txFrom);
    if (txTo)   params.set("to",   txTo);
    const url = `/api/transactions${params.size ? `?${params}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((data: TransactionRow[]) => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [txFrom, txTo]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetch("/api/coa")
      .then((r) => r.json())
      .then((data: { code: string; name: string; parentCode: string | null }[]) => {
        const parentCodes = new Set(data.map((c) => c.parentCode).filter(Boolean));
        setAllCoaOptions(
          data
            .filter((c) => !parentCodes.has(c.code))
            .map(({ code, name }) => ({ code, name }))
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/recipients")
      .then((r) => r.json())
      .then((data: RecipientDetail[]) => setAllRecipients(data))
      .catch(() => {});
  }, []);

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const openCreate = useCallback(() => setSheet({ open: true, mode: "create" }), []);
  const openEdit   = useCallback(
    (t: TransactionRow) => setSheet({ open: true, mode: "edit", transaction: t }),
    []
  );

  const handleFormSuccess = useCallback(() => {
    setSheet((s) => ({ ...s, open: false }));
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSaved = useCallback((id: string) => {
    setSheet((s) => ({ ...s, open: false }));
    fetch(`/api/transactions/${id}`)
      .then((r) => r.json())
      .then((updated: TransactionRow) =>
        setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)))
      )
      .catch(() => fetchTransactions());
  }, [fetchTransactions]);

  const handleDeleted = useCallback((id: string) => {
    setSheet((s) => ({ ...s, open: false }));
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleCreated = useCallback(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const flipSign = useCallback((row: TransactionRow) => {
    const newAmount = String(-parseFloat(row.amount));
    setTransactions((prev) =>
      prev.map((t) => t.id === row.id ? { ...t, amount: newAmount } : t)
    );
    fetch(`/api/transactions/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionDate: row.transactionDate,
        accountingDate:  row.accountingDate,
        accountId:       row.accountId,
        coaCode:         row.coaCode,
        amount:          newAmount,
        currency:        row.currency,
        recipient:       row.recipient,
        notes:           row.notes,
      }),
    }).catch(() => {
      setTransactions((prev) =>
        prev.map((t) => t.id === row.id ? { ...t, amount: row.amount } : t)
      );
    });
  }, []);

  const openLinkDialog   = useCallback((t: TransactionRow) => setLinkDialog({ open: true, transaction: t }), []);
  const openUnlinkDialog = useCallback((t: TransactionRow) => setUnlinkDialog({ open: true, transaction: t }), []);
  const openLinkRecipient = useCallback((t: TransactionRow) => setLinkRecipientDialog({ open: true, transaction: t }), []);

  // ── Filter options (derived) ──────────────────────────────────────────────
  const accountOptions = useMemo(() =>
    Array.from(new Set(transactions.map((t) => t.accountName).filter(Boolean) as string[]))
      .sort()
      .map((name) => ({ value: name, label: name })),
    [transactions]
  );

  const coaOptions = useMemo(() => {
    const seen = new Map<string, string>();
    transactions.forEach((t) => {
      if (t.coaCode && !seen.has(t.coaCode)) seen.set(t.coaCode, t.coaName ?? t.coaCode);
    });
    return Array.from(seen.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, name]) => ({ value: code, label: `${code} – ${name}` }));
  }, [transactions]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterAccounts.length && !filterAccounts.includes(t.accountName ?? "")) return false;
      if (filterCoa.length      && !filterCoa.includes(t.coaCode ?? ""))           return false;
      if (filterRecipient && !t.recipient?.toLowerCase().includes(filterRecipient.toLowerCase())) return false;
      const txDate  = toISO(t.transactionDate);
      if (txFrom && txDate < txFrom) return false;
      if (txTo   && txDate > txTo)   return false;
      if (accMonth) {
        const acM = toISO(t.accountingDate).slice(0, 7);
        if (!acM || acM !== accMonth) return false;
      }
      if (filterOrphans       && !(TRANSFER_CODES.has(t.coaCode ?? "") && !t.transferId)) return false;
      if (filterOrphanAssets  && !(ASSET_COA_CODES.has(t.coaCode ?? "") && !t.assetId))  return false;
      if (filterUncategorized && !!t.coaCode) return false;
      return true;
    });
  }, [transactions, filterAccounts, filterCoa, filterRecipient, txFrom, txTo, accMonth, filterOrphans, filterOrphanAssets, filterUncategorized]);

  const totals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const t of filtered) {
      const v = parseFloat(t.amount ?? "0");
      if (v >= 0) totalIn += v; else totalOut += v;
    }
    return { totalIn, totalOut, net: totalIn + totalOut };
  }, [filtered]);

  const orphanCount = useMemo(
    () => transactions.filter((t) => TRANSFER_CODES.has(t.coaCode ?? "") && !t.transferId).length,
    [transactions]
  );

  const orphanAssetCount = useMemo(
    () => transactions.filter((t) => ASSET_COA_CODES.has(t.coaCode ?? "") && !t.assetId).length,
    [transactions]
  );

  const uncategorizedCount = useMemo(
    () => transactions.filter((t) => !t.coaCode).length,
    [transactions]
  );

  const uncategorizedTransactions = useMemo(
    () => transactions.filter((t) => !t.coaCode),
    [transactions]
  );

  const anyFilter =
    filterAccounts.length > 0 || filterCoa.length > 0 ||
    !!filterRecipient || !!txFrom || !!txTo || !!accMonth ||
    filterOrphans || filterOrphanAssets || filterUncategorized;

  const clearAll = useCallback(() => {
    const defFrom = daysAgo(30);
    const defTo   = today();
    setDraftFilterAccounts([]);
    setDraftFilterCoa([]);
    setDraftFilterRecipient("");
    setDraftTxFrom(defFrom); setDraftTxTo(defTo);
    setDraftAccMonth("");
    setFilterAccounts([]);
    setFilterCoa([]);
    setFilterRecipient("");
    setTxFrom(defFrom); setTxTo(defTo);
    setAccMonth("");
    setFilterOrphans(false);
    setFilterOrphanAssets(false);
    setFilterUncategorized(false);
  }, []);

  const toggleAccount = useCallback((v: string) =>
    setDraftFilterAccounts((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]), []);
  const toggleCoa = useCallback((v: string) =>
    setDraftFilterCoa((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]), []);

  const applyFilters = useCallback(() => {
    setFilterAccounts(draftFilterAccounts);
    setFilterCoa(draftFilterCoa);
    setFilterRecipient(draftFilterRecipient);
    setTxFrom(draftTxFrom);
    setTxTo(draftTxTo);
    setAccMonth(draftAccMonth);
  }, [draftFilterAccounts, draftFilterCoa, draftFilterRecipient, draftTxFrom, draftTxTo, draftAccMonth]);

  const isDirty =
    draftTxFrom !== txFrom ||
    draftTxTo !== txTo ||
    draftAccMonth !== accMonth ||
    JSON.stringify(draftFilterAccounts) !== JSON.stringify(filterAccounts) ||
    JSON.stringify(draftFilterCoa) !== JSON.stringify(filterCoa) ||
    draftFilterRecipient !== filterRecipient;

  // ── Bulk edit handlers ────────────────────────────────────────────────────
  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkApply = useCallback(async (
    data: { coaCode?: string | null; accountingDate?: string | null; recipientId?: string | null }
  ) => {
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds), ...data }),
    });
    fetchTransactions();
    setSelectedIds(new Set());
  }, [selectedIds, fetchTransactions]);

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    const n = filtered.filter((t) => selectedIds.has(t.id)).length;
    el.checked       = n === filtered.length && filtered.length > 0;
    el.indeterminate = n > 0 && n < filtered.length;
  }, [selectedIds, filtered]);

  // ── Pending (foreign-currency or uncategorized) for KPIs ──────────────────
  const pendingCount = useMemo(
    () => filtered.filter((t) => !t.coaCode).length,
    [filtered]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Filter bar (terminal prompt) ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--color-lm-border)] bg-[color:var(--color-lm-bg)] px-3.5 py-2 font-mono text-[11px]">
        <span className="text-[color:var(--color-lm-gain)]">$</span>
        <span className="text-[color:var(--color-lm-fg)]">filter</span>

        <MultiFilter
          label="conta"
          options={accountOptions}
          selected={draftFilterAccounts}
          onToggle={toggleAccount}
          onClear={() => setDraftFilterAccounts([])}
        />

        <MultiFilter
          label="coa"
          options={coaOptions}
          selected={draftFilterCoa}
          onToggle={toggleCoa}
          onClear={() => setDraftFilterCoa([])}
        />

        <DateRangeFilter
          label="período"
          from={draftTxFrom}
          to={draftTxTo}
          onFrom={setDraftTxFrom}
          onTo={setDraftTxTo}
          onClear={() => { setDraftTxFrom(""); setDraftTxTo(""); }}
        />

        <MonthFilter
          label="mês contábil"
          value={draftAccMonth}
          onChange={setDraftAccMonth}
          onClear={() => setDraftAccMonth("")}
        />

        <div className="flex items-center">
          <Input
            placeholder="recipient…"
            value={draftFilterRecipient}
            onChange={(e) => setDraftFilterRecipient(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="h-7 w-44 border-[color:var(--color-lm-border-2)] bg-transparent font-mono text-[11px] text-[color:var(--color-lm-fg)] placeholder:text-[color:var(--color-lm-fg-dim)]"
          />
        </div>

        <LmFilterButton
          variant={isDirty ? "primary" : "default"}
          active={!isDirty}
          onClick={applyFilters}
        >
          aplicar
        </LmFilterButton>

        <LmFilterButton
          active={filterUncategorized}
          onClick={() => setFilterUncategorized((v) => !v)}
        >
          uncat {uncategorizedCount > 0 && `· ${uncategorizedCount}`}
        </LmFilterButton>

        {uncategorizedCount > 0 && (
          <button
            onClick={() => setSuggestSheet(true)}
            className="flex h-7 items-center gap-1.5 border border-[color:var(--color-lm-border-2)] px-2.5 font-mono text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-fg-muted)] hover:text-[color:var(--color-lm-fg)]"
          >
            <Sparkles className="h-3 w-3" /> sugerir
          </button>
        )}

        <LmFilterButton
          active={filterOrphans}
          onClick={() => setFilterOrphans((v) => !v)}
        >
          <span className="inline-flex items-center gap-1">
            <Unlink2 className="h-3 w-3" /> órfãos tx {orphanCount > 0 && `· ${orphanCount}`}
          </span>
        </LmFilterButton>

        <LmFilterButton
          active={filterOrphanAssets}
          onClick={() => setFilterOrphanAssets((v) => !v)}
        >
          <span className="inline-flex items-center gap-1">
            <PackageOpen className="h-3 w-3" /> órfãos ativos {orphanAssetCount > 0 && `· ${orphanAssetCount}`}
          </span>
        </LmFilterButton>

        {anyFilter && (
          <button
            onClick={clearAll}
            className="flex h-7 items-center gap-1 px-2.5 font-mono text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-fg-dim)] hover:text-[color:var(--color-lm-fg)]"
          >
            <X className="h-3 w-3" /> limpar
          </button>
        )}

        <span className="flex-1" />

        <button className="h-7 border border-[color:var(--color-lm-border-2)] bg-transparent px-3 font-mono text-[10px] tracking-[1px] uppercase text-[color:var(--color-lm-fg-muted)] hover:text-[color:var(--color-lm-fg)]">
          IMPORTAR
        </button>
        <button
          onClick={openCreate}
          className="h-7 bg-[color:var(--color-lm-fg)] px-3 font-mono text-[10px] tracking-[1px] uppercase text-[color:var(--color-lm-bg)]"
        >
          + NOVA
        </button>
      </div>

      {/* ── KPI band ─────────────────────────────────────────────────────── */}
      <div
        className="grid border-b border-[color:var(--color-lm-border-2)]"
        style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
      >
        <LmKpi label="Entradas · período" value={totals.totalIn} />
        <LmKpi label="Saídas · período"   value={Math.abs(totals.totalOut)} negative />
        <LmKpi label="Líquido · período"  value={totals.net} negative={totals.net < 0} emphasis />
        <LmKpi
          label="Pendentes"
          value={pendingCount}
          currency={false}
          sub={pendingCount === 1 ? "1 transação" : `${pendingCount} transações`}
        />
        <LmKpi
          label="Transações"
          value={filtered.length.toString()}
          currency={false}
          sub={`${transactions.length} no total`}
        />
      </div>

      {/* ── Bulk edit bar ────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <BulkEditBar
          selectedCount={selectedIds.size}
          coaOptions={allCoaOptions}
          recipients={allRecipients.map((r) => ({ id: r.id, name: r.name }))}
          onApply={handleBulkApply}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-1 p-3.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-6 animate-pulse bg-[rgba(255,255,255,0.02)]"
              />
            ))}
          </div>
        ) : (
          <>
            <div
              className="sticky top-0 z-10 grid items-center border-b border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] px-3.5 py-1.5 text-[9px] uppercase tracking-[1.2px] text-[color:var(--color-lm-fg-dim)]"
              style={{ gridTemplateColumns: ROW_TEMPLATE, gap: 8 }}
            >
              <div>
                <input
                  type="checkbox"
                  ref={headerCheckboxRef}
                  onChange={(e) =>
                    setSelectedIds(e.target.checked ? new Set(filtered.map((t) => t.id)) : new Set())
                  }
                  className="h-3.5 w-3.5 cursor-pointer border-[color:var(--color-lm-border-2)] accent-[color:var(--color-lm-fg)]"
                />
              </div>
              <div>Data</div>
              <div>Recipient</div>
              <div>Descrição</div>
              <div>Conta</div>
              <div>Categoria · COA</div>
              <div className="text-right">CCY</div>
              <div className="text-right">Débito</div>
              <div className="text-right">Crédito</div>
              <div className="text-center">Link</div>
              <div className="text-right">Stat</div>
              <div />
            </div>

            {filtered.length ? (
              filtered.map((t, i) => {
                const prev = i > 0 ? filtered[i - 1] : null;
                const isNewDay = !prev || toISO(prev.transactionDate) !== toISO(t.transactionDate);
                return (
                  <TxRow
                    key={t.id}
                    row={t}
                    isSelected={selectedIds.has(t.id)}
                    isNewDay={isNewDay}
                    stripe={i % 2 === 1}
                    onToggle={toggleRow}
                    onEdit={openEdit}
                    onFlipSign={flipSign}
                    onLink={openLinkDialog}
                    onUnlink={openUnlinkDialog}
                    onLinkRecipient={openLinkRecipient}
                  />
                );
              })
            ) : (
              <div className="flex h-32 items-center justify-center text-[11px] text-[color:var(--color-lm-fg-muted)]">
                {anyFilter
                  ? "nenhuma transação corresponde aos filtros atuais."
                  : "nenhuma transação ainda. adicione uma para começar."}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Status bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 border-t border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-bg)] px-3.5 py-1.5 font-mono text-[10px] tracking-[0.5px] text-[color:var(--color-lm-fg-dim)]">
        <span>
          <span className="text-[color:var(--color-lm-fg-muted)]">row</span>{" "}
          {filtered.length}/{transactions.length}
        </span>
        <span className="flex-1" />
        <span>
          Σ débito{" "}
          <span className="text-[color:var(--color-lm-loss)]">
            R$ {fmtBRL(Math.abs(totals.totalOut))}
          </span>
        </span>
        <span>
          Σ crédito{" "}
          <span className="text-[color:var(--color-lm-gain)]">
            R$ {fmtBRL(totals.totalIn)}
          </span>
        </span>
        <span>
          net{" "}
          <span className="text-[color:var(--color-lm-fg)]">
            {totals.net >= 0 ? "+" : "−"}R$ {fmtBRL(Math.abs(totals.net))}
          </span>
        </span>
      </div>

      {/* ── Sheet (drawer) ────────────────────────────────────────────────── */}
      <Sheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}>
        <SheetContent
          showCloseButton={false}
          className="!w-[440px] !max-w-[440px] border-l border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-bg)] p-0 font-mono text-[11px] text-[color:var(--color-lm-fg)]"
        >
          <SheetHeader className="flex-row items-baseline gap-2.5 border-b border-[color:var(--color-lm-border-2)] px-5 py-3.5">
            <span className="text-[color:var(--color-lm-gain)]">■</span>
            <div className="flex-1">
              <SheetTitle className="font-mono text-[14px] font-normal tracking-[-0.2px] text-[color:var(--color-lm-fg)]">
                {sheet.mode === "create" ? "Nova transação" : "Editar transação"}
              </SheetTitle>
              <div className="mt-0.5 text-[10px] text-[color:var(--color-lm-fg-dim)]">
                {sheet.mode === "create" ? "preencha os campos · Tab avança" : "ajuste e salve"}
              </div>
            </div>
            <button
              onClick={() => setSheet((s) => ({ ...s, open: false }))}
              className="text-[10px] text-[color:var(--color-lm-fg-dim)]"
              title="Fechar (Esc)"
            >
              ESC
            </button>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <TransactionForm
              key={sheet.mode === "edit" ? sheet.transaction?.id : "create"}
              transaction={sheet.transaction}
              onSuccess={handleFormSuccess}
              onCreated={handleCreated}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      {linkDialog.transaction && (
        <LinkTransferDialog
          open={linkDialog.open}
          onOpenChange={(open) => setLinkDialog((s) => ({ ...s, open }))}
          transaction={linkDialog.transaction}
          candidates={transactions.filter(
            (t) =>
              TRANSFER_CODES.has(t.coaCode ?? "") &&
              !t.transferId &&
              t.id !== linkDialog.transaction!.id
          )}
          onLinked={(transferId) => {
            setTransactions((prev) =>
              prev.map((t) =>
                t.id === linkDialog.transaction!.id || t.id === transactions.find(
                  (x) => TRANSFER_CODES.has(x.coaCode ?? "") && !x.transferId && x.id !== linkDialog.transaction!.id
                )?.id
                  ? { ...t, transferId }
                  : t
              )
            );
            fetchTransactions();
          }}
        />
      )}

      {linkRecipientDialog.transaction && (
        <LinkRecipientDialog
          open={linkRecipientDialog.open}
          onOpenChange={(open) => setLinkRecipientDialog((s) => ({ ...s, open }))}
          transaction={linkRecipientDialog.transaction}
          allRecipients={allRecipients}
          onLinked={(recipientId, recipientName) => {
            setTransactions((prev) =>
              prev.map((t) =>
                t.id === linkRecipientDialog.transaction!.id
                  ? { ...t, recipientId, linkedRecipientName: recipientName }
                  : t
              )
            );
          }}
        />
      )}

      <SuggestCategoriesSheet
        open={suggestSheet}
        onOpenChange={setSuggestSheet}
        uncategorized={uncategorizedTransactions}
        allRecipients={allRecipients}
        onApplied={fetchTransactions}
      />

      {unlinkDialog.transaction && (
        <UnlinkTransferDialog
          open={unlinkDialog.open}
          onOpenChange={(open) => setUnlinkDialog((s) => ({ ...s, open }))}
          transaction={unlinkDialog.transaction}
          partner={transactions.find(
            (t) =>
              t.transferId === unlinkDialog.transaction!.transferId &&
              t.id !== unlinkDialog.transaction!.id
          )}
          onUnlinked={() => {
            const tid = unlinkDialog.transaction!.transferId;
            setTransactions((prev) =>
              prev.map((t) => (t.transferId === tid ? { ...t, transferId: null } : t))
            );
          }}
        />
      )}
    </div>
  );
}

