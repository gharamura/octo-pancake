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
  type AssetLiquidity,
  type AssetRiskFactor,
  type FinancialAccount,
} from "@/lib/db/schema";
import { useEffect, useState } from "react";

const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "ARS", "CLP", "COP", "MXN", "UYU", "BTC", "ETH"];

const ASSET_CLASSES: { value: AssetClass; label: string }[] = [
  { value: "cash_equivalents",            label: "Cash Equivalents" },
  { value: "fixed_income",               label: "Fixed Income" },
  { value: "fixed_income_private_credit", label: "Fixed Income – Private Credit" },
  { value: "fixed_income_intl_bonds",    label: "Fixed Income – Intl Bonds" },
  { value: "structured_products",        label: "Structured Products" },
  { value: "equities",                   label: "Equities" },
  { value: "real_estate_agro",           label: "Real Estate & Agro" },
  { value: "private_equity",             label: "Private Equity" },
  { value: "crypto",                     label: "Crypto" },
  { value: "commodities",               label: "Commodities" },
  { value: "hedge_funds",               label: "Hedge Funds" },
  { value: "pension",                    label: "Pension" },
];

const GEOGRAPHIES: { value: AssetGeography; label: string }[] = [
  { value: "BR",           label: "BR" },
  { value: "US",           label: "US" },
  { value: "China",        label: "China" },
  { value: "Global",       label: "Global" },
  { value: "Offshore USD", label: "Offshore USD" },
];

const RISK_FACTORS: { value: AssetRiskFactor; label: string }[] = [
  { value: "interest_rate",           label: "Interest Rate" },
  { value: "credit_spread",           label: "Credit Spread" },
  { value: "equity",                  label: "Equity" },
  { value: "commodity",               label: "Commodity" },
  { value: "crypto",                  label: "Crypto" },
  { value: "structured_optionality",  label: "Structured Optionality" },
  { value: "illiquid_private_assets", label: "Illiquid Private Assets" },
  { value: "dollar",                  label: "Dollar" },
  { value: "gold",                    label: "Gold" },
  { value: "inflation",               label: "Inflation" },
];

const LIQUIDITIES: { value: AssetLiquidity; label: string }[] = [
  { value: "daily",      label: "Daily" },
  { value: "d30_90",     label: "D+30–90" },
  { value: "lockup",     label: "Lock-up" },
  { value: "closed_end", label: "Closed-end" },
  { value: "illiquid",   label: "Illiquid" },
];

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
  const [liquidity,      setLiquidity]      = useState<AssetLiquidity | "">(asset?.liquidity ?? "");
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
          <Select value={liquidity} onValueChange={(v) => setLiquidity(v as AssetLiquidity)}>
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {LIQUIDITIES.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
