"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CashFlowResult, DayProjection } from "@/lib/cash-flow/calculator";
import type { TransferSuggestion, WithdrawalSuggestion } from "@/lib/cash-flow/suggestions";
import type { CashFlowSpot, FinancialAccount } from "@/lib/db/schema";
import { ArrowLeftRight, ChevronDown, ChevronLeft, ChevronRight, ListFilter, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CashFlowSuggestions } from "@/components/cash-flow-suggestions";

// ---------------------------------------------------------------------------
// Ledger tokens for Recharts
// ---------------------------------------------------------------------------

const LM = {
  bg:      "#0a0a0a",
  border:  "#1f1f1f",
  fg:      "#e8e6df",
  fgMuted: "#8a8680",
  fgDim:   "#555049",
  gain:    "#6ba368",
  loss:    "#c84e4e",
  pending: "#c89c4e",
  palette: [
    "#6ba368", "#c89c4e", "#5b8fc4", "#b87ab8",
    "#5ec4c4", "#d47a5e", "#7ab87a", "#a0a0d0",
  ],
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatMonthLabel(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiResponse {
  cashFlow: CashFlowResult;
  transferSuggestions: TransferSuggestion[];
  withdrawalSuggestions: WithdrawalSuggestion[];
}

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------

interface ChartDatum {
  day: number;
  [accountId: string]: number;
}

function buildChartData(timeline: DayProjection[], accountIds: string[]): ChartDatum[] {
  return timeline.map((t) => {
    const d: ChartDatum = { day: t.dayOfMonth };
    for (const id of accountIds) {
      d[id] = t.balances[id] ?? 0;
    }
    return d;
  });
}

// ---------------------------------------------------------------------------
// Add-spot popover
// ---------------------------------------------------------------------------

function AddSpotPopover({
  day, year, month, accounts,
  onAdd,
}: {
  day: number; year: number; month: number;
  accounts: FinancialAccount[];
  onAdd: (spot: Omit<CashFlowSpot, "id" | "createdAt" | "updatedAt">) => void;
}) {
  const [open,      setOpen]      = useState(false);
  const [name,      setName]      = useState("");
  const [type,      setType]      = useState<"income" | "expense">("expense");
  const [amount,    setAmount]    = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [saving,    setSaving]    = useState(false);

  function reset() { setName(""); setAmount(""); setType("expense"); setSaving(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !amount || !accountId) return;
    setSaving(true);
    await onAdd({ name, type, amount, accountId, year, month, dayOfMonth: day, currency: "BRL", coaCode: null, notes: null });
    reset();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="opacity-30 hover:opacity-100 text-muted-foreground hover:text-foreground"
          title="Adicionar lançamento estimado"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 space-y-3">
        <p className="text-xs font-medium">Lançamento estimado · Dia {day}</p>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-[10px]">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. IPTU, Férias…" className="h-7 text-xs" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "income" | "expense")}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Valor</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="h-7 text-xs" required />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm" className="w-full h-7 text-xs" disabled={saving}>
            {saving ? "Salvando…" : "Adicionar"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Transfer popover (per-row)
// ---------------------------------------------------------------------------

function TransferPopover({
  day, year, month, accounts, onAdd,
}: {
  day: number; year: number; month: number;
  accounts: FinancialAccount[];
  onAdd: (spot: Omit<CashFlowSpot, "id" | "createdAt" | "updatedAt">) => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [label,  setLabel]  = useState("Transferência");
  const [amount, setAmount] = useState("");
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId,   setToId]   = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFromId(accounts[0]?.id ?? "");
      setToId(accounts[1]?.id ?? accounts[0]?.id ?? "");
    }
  }, [open, accounts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fromId === toId || !amount) return;
    setSaving(true);
    const pairId = crypto.randomUUID();
    const base = { year, month, dayOfMonth: day, currency: "BRL", coaCode: null, notes: null, pairId };
    await onAdd({ ...base, name: `${label} (saída)`,   type: "expense", amount, accountId: fromId });
    await onAdd({ ...base, name: `${label} (entrada)`, type: "income",  amount, accountId: toId });
    setLabel("Transferência"); setAmount(""); setSaving(false);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="opacity-30 hover:opacity-100 text-muted-foreground hover:text-foreground"
          title="Simular transferência"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 space-y-3">
        <p className="text-xs font-medium">Simular transferência · Dia {day}</p>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-[10px]">Descrição</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-7 text-xs" required />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Valor</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="h-7 text-xs" required />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">De (origem)</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Para (destino)</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.filter((a) => a.id !== fromId).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm" className="w-full h-7 text-xs" disabled={saving || fromId === toId}>
            {saving ? "Simulando…" : "Simular"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Add spot sheet (top-bar version — includes day picker)
// ---------------------------------------------------------------------------

function AddSpotSheet({
  open, onOpenChange, year, month, accounts, onAdd,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  year: number; month: number;
  accounts: FinancialAccount[];
  onAdd: (spot: Omit<CashFlowSpot, "id" | "createdAt" | "updatedAt">) => Promise<void>;
}) {
  const [name,       setName]       = useState("");
  const [type,       setType]       = useState<"income" | "expense">("expense");
  const [amount,     setAmount]     = useState("");
  const [accountId,  setAccountId]  = useState(accounts[0]?.id ?? "");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (open) { setAccountId(accounts[0]?.id ?? ""); }
  }, [open, accounts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onAdd({ name, type, amount, accountId, year, month, dayOfMonth: parseInt(dayOfMonth, 10), currency: "BRL", coaCode: null, notes: null });
    setName(""); setAmount(""); setType("expense"); setDayOfMonth("1"); setSaving(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[360px]">
        <SheetHeader><SheetTitle>Lançamento estimado</SheetTitle></SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. IPTU, Férias…" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "income" | "expense")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dia do mês</Label>
              <Input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Valor</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required />
          </div>
          <div className="space-y-1.5">
            <Label>Conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Salvando…" : "Adicionar"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Simulate transfer sheet — creates two paired spots (debit + credit)
// ---------------------------------------------------------------------------

function SimulateTransferSheet({
  open, onOpenChange, year, month, accounts, onAdd,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  year: number; month: number;
  accounts: FinancialAccount[];
  onAdd: (spot: Omit<CashFlowSpot, "id" | "createdAt" | "updatedAt">) => Promise<void>;
}) {
  const [label,      setLabel]      = useState("Transferência simulada");
  const [amount,     setAmount]     = useState("");
  const [fromId,     setFromId]     = useState(accounts[0]?.id ?? "");
  const [toId,       setToId]       = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (open && accounts.length >= 2) {
      setFromId(accounts[0].id);
      setToId(accounts[1].id);
    }
  }, [open, accounts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fromId === toId) return;
    setSaving(true);
    const day = parseInt(dayOfMonth, 10);
    const pairId = crypto.randomUUID();
    const base = { year, month, dayOfMonth: day, currency: "BRL", coaCode: null, notes: null, pairId };
    await onAdd({ ...base, name: `${label} (saída)`,   type: "expense", amount, accountId: fromId });
    await onAdd({ ...base, name: `${label} (entrada)`, type: "income",  amount, accountId: toId });
    setLabel("Transferência simulada"); setAmount(""); setDayOfMonth("1"); setSaving(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[360px]">
        <SheetHeader><SheetTitle>Simular transferência</SheetTitle></SheetHeader>
        <p className="mt-1 text-xs text-muted-foreground">
          Cria dois lançamentos estimados: débito na origem e crédito no destino.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required />
            </div>
            <div className="space-y-1.5">
              <Label>Dia do mês</Label>
              <Input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>De (origem)</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Para (destino)</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.filter((a) => a.id !== fromId).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={saving || fromId === toId}>
            {saving ? "Simulando…" : "Simular transferência"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CashFlowView() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [allAccounts,     setAllAccounts]     = useState<FinancialAccount[]>([]);
  const [selectedIds,     setSelectedIds]     = useState<string[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [data,    setData]    = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Spot transactions
  const [spots,        setSpots]        = useState<CashFlowSpot[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(false);
  const [addSpotOpen,      setAddSpotOpen]      = useState(false);
  const [transferOpen,     setTransferOpen]     = useState(false);
  const [suggestionsOpen,  setSuggestionsOpen]  = useState(false);

  // Fetch accounts
  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((accounts: FinancialAccount[]) => {
        const active = accounts.filter((a) => a.isActive);
        setAllAccounts(active);
        const defaults = active
          .filter((a) =>
            (a.type === "checking" && !a.institution?.toLowerCase().includes("btg")) ||
            a.institution?.toLowerCase().includes("caju") ||
            a.name?.toLowerCase().includes("caju")
          )
          .map((a) => a.id);
        setSelectedIds(defaults.length ? defaults : active.map((a) => a.id));
        setAccountsLoading(false);
      })
      .catch(() => setAccountsLoading(false));
  }, []);

  // Fetch cash flow data
  const fetchData = useCallback(() => {
    if (accountsLoading) return;
    setLoading(true);
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    for (const id of selectedIds) params.append("accountIds[]", id);
    fetch(`/api/cash-flow?${params}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year, month, selectedIds, accountsLoading]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch spots for current month
  const fetchSpots = useCallback(() => {
    setSpotsLoading(true);
    fetch(`/api/cash-flow/spots?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d: CashFlowSpot[]) => { setSpots(d); setSpotsLoading(false); })
      .catch(() => setSpotsLoading(false));
  }, [year, month]);

  useEffect(() => { fetchSpots(); }, [fetchSpots]);

  const addSpot = useCallback(async (spot: Omit<CashFlowSpot, "id" | "createdAt" | "updatedAt">) => {
    const res = await fetch("/api/cash-flow/spots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spot),
    });
    if (res.ok) { fetchSpots(); fetchData(); }
  }, [fetchSpots, fetchData]);

  const deleteSpot = useCallback(async (id: string) => {
    await fetch(`/api/cash-flow/spots/${id}`, { method: "DELETE" });
    fetchSpots();
    fetchData();
  }, [fetchSpots, fetchData]);

  // Month navigation
  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  // Account multi-select
  const toggleAccount = useCallback((id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]), []);
  const selectAll = useCallback(() => setSelectedIds(allAccounts.map((a) => a.id)), [allAccounts]);
  const clearAll  = useCallback(() => setSelectedIds([]), []);

  const accountLabel = useMemo(() => {
    if (!selectedIds.length) return "No accounts";
    if (selectedIds.length === allAccounts.length) return "All accounts";
    if (selectedIds.length === 1) return allAccounts.find((a) => a.id === selectedIds[0])?.name ?? "1 account";
    return `${selectedIds.length} accounts`;
  }, [selectedIds, allAccounts]);

  const isFiltered = selectedIds.length > 0 && selectedIds.length < allAccounts.length;

  // Build chart data
  const chartData = useMemo(() => {
    if (!data) return [];
    return buildChartData(data.cashFlow.timeline, selectedIds);
  }, [data, selectedIds]);

  // Account name map
  const accNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of allAccounts) m.set(a.id, a.name);
    return m;
  }, [allAccounts]);

  // Which days have any negative balance
  const negDays = useMemo(() => {
    if (!data) return new Set<number>();
    const s = new Set<number>();
    for (const day of data.cashFlow.timeline) {
      if (selectedIds.some((id) => (day.balances[id] ?? 0) < 0)) {
        s.add(day.dayOfMonth);
      }
    }
    return s;
  }, [data, selectedIds]);

  if (accountsLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Month nav */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center text-sm font-medium capitalize">
            {formatMonthLabel(year, month)}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Account multi-select */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[180px] justify-between">
              <span className="truncate">{accountLabel}</span>
              {isFiltered
                ? <ListFilter className="ml-2 h-3.5 w-3.5 shrink-0 text-primary" />
                : <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[220px] max-h-72 overflow-y-auto">
            {allAccounts.map((account) => (
              <DropdownMenuCheckboxItem
                key={account.id}
                checked={selectedIds.includes(account.id)}
                onCheckedChange={() => toggleAccount(account.id)}
                onSelect={(e) => e.preventDefault()}
              >
                <span className="flex flex-col">
                  <span>{account.name}</span>
                  {account.type && (
                    <span className="text-[11px] text-muted-foreground capitalize">
                      {account.type.replace(/_/g, " ")}
                    </span>
                  )}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <div className="flex gap-1 px-2 py-1">
              <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={selectAll}>All</Button>
              <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={clearAll}>None</Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex gap-2">
          {data && (data.transferSuggestions.length > 0 || data.withdrawalSuggestions.length > 0) && (
            <Button variant="outline" size="sm" className="relative" onClick={() => setSuggestionsOpen(true)}>
              Sugestões
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                {data.transferSuggestions.length + data.withdrawalSuggestions.length}
              </span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> Transferência
          </Button>
          <Button size="sm" onClick={() => setAddSpotOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Lançamento
          </Button>
        </div>
      </div>

      <AddSpotSheet
        open={addSpotOpen}
        onOpenChange={setAddSpotOpen}
        year={year} month={month}
        accounts={allAccounts.filter((a) => selectedIds.includes(a.id))}
        onAdd={addSpot}
      />
      <SimulateTransferSheet
        open={transferOpen}
        onOpenChange={setTransferOpen}
        year={year} month={month}
        accounts={allAccounts.filter((a) => selectedIds.includes(a.id))}
        onAdd={addSpot}
      />

      {/* Suggestions sheet */}
      <Sheet open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
        <SheetContent className="w-[420px] overflow-y-auto">
          <SheetHeader><SheetTitle>Sugestões</SheetTitle></SheetHeader>
          <div className="mt-4">
            {data && (
              <CashFlowSuggestions
                transferSuggestions={data.transferSuggestions}
                withdrawalSuggestions={data.withdrawalSuggestions}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Full-width layout */}
      <div className="space-y-4">
        <div className="space-y-4">
          {/* Chart */}
          <div className="rounded-md border p-4">
            <h3 className="mb-3 text-sm font-semibold">Balance Projection</h3>
            {loading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={LM.border} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: LM.fgDim, fontSize: 10 }}
                    axisLine={{ stroke: LM.border }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: LM.fgDim, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => fmt.format(v)}
                    width={80}
                  />
                  <ReferenceLine y={0} stroke={LM.loss} strokeDasharray="4 2" strokeOpacity={0.6} />
                  <Tooltip
                    contentStyle={{
                      background: "#141414",
                      border: `1px solid ${LM.border}`,
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                    formatter={(value: number | undefined, name: string | undefined) => [
                      fmt.format(value ?? 0),
                      accNameMap.get(name ?? "") ?? (name ?? ""),
                    ]}
                    labelFormatter={(label) => `Day ${label}`}
                  />
                  <Legend
                    formatter={(value) => accNameMap.get(value) ?? value}
                    wrapperStyle={{ fontSize: 11, color: LM.fgMuted }}
                  />
                  {selectedIds.map((id, i) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={id}
                      stroke={LM.palette[i % LM.palette.length]}
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Day table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Day</TableHead>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead>Transactions</TableHead>
                  {selectedIds.map((id) => (
                    <TableHead key={id} className="text-right">
                      {accNameMap.get(id) ?? id}
                    </TableHead>
                  ))}
                  {selectedIds.length > 1 && (
                    <TableHead className="text-right font-semibold">Total</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={3 + selectedIds.length + (selectedIds.length > 1 ? 1 : 0)}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.cashFlow.timeline.length ? (
                  data.cashFlow.timeline.map((day) => {
                    const isNeg = negDays.has(day.dayOfMonth);
                    return (
                      <TableRow
                        key={day.dayOfMonth}
                        className={`group/row ${isNeg ? "bg-red-950/20" : ""}`}
                      >
                        <TableCell className="tabular-nums text-xs font-mono text-muted-foreground">
                          {day.dayOfMonth}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(day.date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            {day.transactions.length > 0 ? (
                              <ul className="flex-1 space-y-0.5">
                                {day.transactions.map((tx) => (
                                  <li key={tx.recurringId} className="flex items-center gap-1.5 text-xs">
                                    <span className={tx.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                      {tx.amount >= 0 ? "+" : ""}{fmt.format(tx.amount)}
                                    </span>
                                    <span className="text-muted-foreground">{tx.name}</span>
                                    <span className="text-[10px] text-muted-foreground/50">
                                      {accNameMap.get(tx.accountId) ?? ""}
                                    </span>
                                    {tx.isSpot && (
                                      <>
                                        <span className="rounded border border-amber-500/40 px-1 text-[9px] text-amber-500">
                                          {tx.pairId ? "transf." : "est."}
                                        </span>
                                        <button
                                          className="text-muted-foreground hover:text-destructive"
                                          onClick={() => deleteSpot(tx.recurringId)}
                                          title={tx.pairId ? "Remover transferência (ambas as partes)" : "Remover estimativa"}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="flex-1 text-xs text-muted-foreground">—</span>
                            )}
                            <AddSpotPopover
                              day={day.dayOfMonth}
                              year={year} month={month}
                              accounts={allAccounts.filter((a) => selectedIds.includes(a.id))}
                              onAdd={addSpot}
                            />
                            <TransferPopover
                              day={day.dayOfMonth}
                              year={year} month={month}
                              accounts={allAccounts.filter((a) => selectedIds.includes(a.id))}
                              onAdd={addSpot}
                            />
                          </div>
                        </TableCell>
                        {selectedIds.map((id) => {
                          const bal = day.balances[id] ?? 0;
                          return (
                            <TableCell key={id} className="text-right">
                              <span
                                className={`tabular-nums text-xs font-medium ${
                                  bal < 0
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {fmt.format(bal)}
                              </span>
                            </TableCell>
                          );
                        })}
                        {selectedIds.length > 1 && (() => {
                          const total = selectedIds.reduce((sum, id) => sum + (day.balances[id] ?? 0), 0);
                          return (
                            <TableCell className="text-right">
                              <span className={`tabular-nums text-xs font-semibold ${total < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                                {fmt.format(total)}
                              </span>
                            </TableCell>
                          );
                        })()}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={3 + selectedIds.length + (selectedIds.length > 1 ? 1 : 0)}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No data for selected accounts and period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
