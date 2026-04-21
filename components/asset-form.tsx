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
import { Switch } from "@/components/ui/switch";
import {
  type Asset,
  type AssetClass,
  type AssetGeography,
  type AssetIndex,
  type AssetLiquidity,
  type AssetRiskFactor,
  type FinancialAccount,
} from "@/lib/db/schema";
import { useEffect, useState } from "react";

const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "ARS", "CLP", "COP", "MXN", "UYU", "BTC", "ETH"];

const ASSET_CLASSES: { value: AssetClass; label: string }[] = [
  { value: "cash_equivalents",   label: "Cash Equivalents" },
  { value: "fixed_income",       label: "Fixed Income" },
  { value: "investment_funds",   label: "Investment Funds" },
  { value: "structured_products", label: "Structured Products" },
  { value: "variable_income",    label: "Variable Income" },
  { value: "crypto",             label: "Crypto" },
  { value: "pension",            label: "Pension" },
];

const GEOGRAPHIES: { value: AssetGeography; label: string }[] = [
  { value: "BR",           label: "BR" },
  { value: "US",           label: "US" },
  { value: "China",        label: "China" },
  { value: "Global",       label: "Global" },
  { value: "Offshore USD", label: "Offshore USD" },
];

const RISK_FACTORS: { value: AssetRiskFactor; label: string }[] = [
  { value: "adr",          label: "ADR" },
  { value: "agro",         label: "Agro" },
  { value: "alternatives", label: "Alternatives" },
  { value: "bank",         label: "Bank" },
  { value: "cash",         label: "Cash" },
  { value: "china",        label: "China" },
  { value: "commodities",  label: "Commodities" },
  { value: "corporate",    label: "Corporate" },
  { value: "crypto",       label: "Crypto" },
  { value: "debentures",   label: "Debentures" },
  { value: "etf",          label: "ETF" },
  { value: "fixed_income", label: "Fixed Income" },
  { value: "gold",         label: "Gold" },
  { value: "hedge",        label: "Hedge" },
  { value: "real_estate",  label: "Real Estate" },
  { value: "reit",         label: "REIT" },
  { value: "stocks",       label: "Stocks" },
  { value: "us",           label: "US" },
];

const INDEXES: { value: AssetIndex; label: string }[] = [
  { value: "CDI",  label: "CDI" },
  { value: "IPCA", label: "IPCA" },
  { value: "PGBL", label: "PGBL" },
  { value: "Pre",  label: "Pre" },
  { value: "TR",   label: "TR" },
  { value: "VGBL", label: "VGBL" },
];

function parseLiquidity(raw: string): { type: "market" | "lockup" | "days" | ""; days: string } {
  if (!raw) return { type: "", days: "" };
  if (raw === "market") return { type: "market", days: "" };
  if (raw === "lockup") return { type: "lockup", days: "" };
  return { type: "days", days: raw };
}

function toDateInputValue(val: unknown): string {
  if (!val) return "";
  const s = String(val);
  return s.includes("T") ? s.split("T")[0] : s;
}

interface AssetFormProps {
  asset?: Asset;
  onSuccess: () => void;
}

export function AssetForm({ asset, onSuccess }: AssetFormProps) {
  const isEdit = !!asset;

  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [accountId,      setAccountId]      = useState(asset?.accountId      ?? "");
  const [name,           setName]           = useState(asset?.name            ?? "");
  const [assetClass,     setAssetClass]     = useState<AssetClass | "">(asset?.assetClass ?? "");
  const [geography,      setGeography]      = useState<AssetGeography | "">(asset?.geography ?? "");
  const [riskFactor,     setRiskFactor]     = useState<AssetRiskFactor | "">(asset?.riskFactor ?? "");
  const [index,          setIndex]          = useState<AssetIndex | "">(asset?.index ?? "");
  const parsed = parseLiquidity(asset?.liquidity ?? "");
  const [liquidityType, setLiquidityType] = useState<"market" | "lockup" | "days" | "">(parsed.type);
  const [liquidityDays, setLiquidityDays] = useState(parsed.days);
  const liquidity = liquidityType === "market" ? "market"
    : liquidityType === "lockup" ? "lockup"
    : liquidityType === "days" && liquidityDays ? liquidityDays
    : "";
  const [custodian,      setCustodian]      = useState(asset?.custodian       ?? "");
  const [currency,       setCurrency]       = useState(asset?.currency        ?? "BRL");
  const [expirationDate, setExpirationDate] = useState(toDateInputValue(asset?.expirationDate));
  const [rule,           setRule]           = useState(asset?.rule             ?? "");
  const [isActive,       setIsActive]       = useState(asset?.isActive         ?? true);
  const [error,          setError]          = useState<string | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [deleting,       setDeleting]       = useState(false);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: FinancialAccount[]) => setAccounts(data))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        accountId,
        name,
        assetClass:     assetClass     || null,
        geography:      geography      || null,
        riskFactor:     riskFactor     || null,
        index:          index          || null,
        liquidity:      liquidity      || null,
        custodian:      custodian      || null,
        currency,
        expirationDate: expirationDate || null,
        rule:           rule           || null,
        isActive,
      };

      const res = await fetch(
        isEdit ? `/api/assets/${asset.id}` : "/api/assets",
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
    if (!asset) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not delete asset.");
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
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tesouro IPCA+ 2035"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Class</Label>
        <Select value={assetClass} onValueChange={(v) => setAssetClass(v as AssetClass)}>
          <SelectTrigger>
            <SelectValue placeholder="Select class…" />
          </SelectTrigger>
          <SelectContent>
            {ASSET_CLASSES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Geography</Label>
          <Select value={geography} onValueChange={(v) => setGeography(v as AssetGeography)}>
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {GEOGRAPHIES.map((g) => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Liquidity</Label>
          <Select
            value={liquidityType || "__none__"}
            onValueChange={(v) => {
              setLiquidityType(v === "__none__" ? "" : v as "market" | "lockup" | "days");
              if (v !== "days") setLiquidityDays("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None —</SelectItem>
              <SelectItem value="market">Market</SelectItem>
              <SelectItem value="lockup">Lock-up</SelectItem>
              <SelectItem value="days">Days</SelectItem>
            </SelectContent>
          </Select>
          {liquidityType === "days" && (
            <Input
              type="number"
              min="1"
              placeholder="e.g. 30"
              value={liquidityDays}
              onChange={(e) => setLiquidityDays(e.target.value)}
            />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Risk Factor</Label>
        <Select value={riskFactor} onValueChange={(v) => setRiskFactor(v as AssetRiskFactor)}>
          <SelectTrigger>
            <SelectValue placeholder="Select risk factor…" />
          </SelectTrigger>
          <SelectContent>
            {RISK_FACTORS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="custodian">Custodian</Label>
        <Input
          id="custodian"
          value={custodian}
          onChange={(e) => setCustodian(e.target.value)}
          placeholder="e.g. BTG, XP, Nubank"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Currency</Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expirationDate">Expiration Date</Label>
        <Input
          id="expirationDate"
          type="date"
          value={expirationDate}
          onChange={(e) => setExpirationDate(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Index</Label>
        <Select value={index || "__none__"} onValueChange={(v) => setIndex(v === "__none__" ? "" : v as AssetIndex)}>
          <SelectTrigger>
            <SelectValue placeholder="Select index…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None —</SelectItem>
            {INDEXES.map((i) => (
              <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rule">Rule / Index</Label>
        <Input
          id="rule"
          value={rule}
          onChange={(e) => setRule(e.target.value)}
          placeholder="e.g. IPCA+6.5%, 110% CDI"
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
        <Label htmlFor="isActive">Active</Label>
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
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Asset"}
        </Button>
      </div>
    </form>
  );
}
