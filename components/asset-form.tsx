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
import { type Asset, type AssetType, type FinancialAccount } from "@/lib/db/schema";
import { useEffect, useState } from "react";

const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "ARS", "CLP", "COP", "MXN", "UYU", "BTC", "ETH"];

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "investment_fund",  label: "Investment Fund" },
  { value: "treasury_bonds",   label: "Treasury Bonds" },
  { value: "cdb",              label: "CDB" },
  { value: "corporate_bonds",  label: "Corporate Bonds" },
  { value: "etf",              label: "ETF" },
  { value: "adr",              label: "ADR" },
  { value: "reit",             label: "REIT" },
  { value: "stocks",           label: "Stocks" },
  { value: "coe",              label: "COE" },
  { value: "crypto",           label: "Crypto" },
  { value: "lca",              label: "LCA" },
  { value: "pension",          label: "Pension" },
  { value: "cri",              label: "CRI" },
  { value: "cra",              label: "CRA" },
  { value: "cash",             label: "Cash" },
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
  const [accountId,      setAccountId]      = useState(asset?.accountId ?? "");
  const [name,           setName]           = useState(asset?.name ?? "");
  const [type,           setType]           = useState<AssetType>(asset?.type ?? "investment_fund");
  const [custodian,      setCustodian]      = useState(asset?.custodian ?? "");
  const [currency,       setCurrency]       = useState(asset?.currency ?? "BRL");
  const [country,        setCountry]        = useState(asset?.country ?? "BR");
  const [expirationDate, setExpirationDate] = useState(toDateInputValue(asset?.expirationDate));
  const [rule,           setRule]           = useState(asset?.rule ?? "");
  const [isActive,       setIsActive]       = useState(asset?.isActive ?? true);
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
        type,
        custodian:      custodian      || null,
        currency,
        country:        country        || "BR",
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
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as AssetType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSET_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
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

      <div className="grid grid-cols-2 gap-3">
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
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="BR"
            maxLength={4}
            className="uppercase"
          />
        </div>
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
