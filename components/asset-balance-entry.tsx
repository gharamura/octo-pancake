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
import { type Asset, type FinancialAccount } from "@/lib/db/schema";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Today in YYYY-MM-DD
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssetBalanceEntry() {
  const [accounts,    setAccounts]    = useState<FinancialAccount[]>([]);
  const [accountId,   setAccountId]   = useState("");
  const [date,        setDate]        = useState(todayISO());
  const [includeAll,  setIncludeAll]  = useState(false);
  const [assetList,   setAssetList]   = useState<Asset[]>([]);
  const [balances,    setBalances]    = useState<Record<string, string>>({});
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [savedCount,  setSavedCount]  = useState<number | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  // Fetch accounts on mount
  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: FinancialAccount[]) => setAccounts(data))
      .catch(() => {});
  }, []);

  // Fetch assets when account or includeAll changes
  useEffect(() => {
    if (!accountId) {
      setAssetList([]);
      setBalances({});
      return;
    }
    setLoading(true);
    setSavedCount(null);
    setError(null);
    const params = new URLSearchParams({ accountId });
    if (includeAll) params.set("includeAll", "true");
    fetch(`/api/assets?${params}`)
      .then((r) => r.json())
      .then((data: Asset[]) => {
        setAssetList(data);
        setBalances({});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [accountId, includeAll]);

  function setBalance(assetId: string, value: string) {
    setBalances((prev) => ({ ...prev, [assetId]: value }));
    setSavedCount(null);
  }

  const filledCount = Object.values(balances).filter((v) => v !== "").length;

  async function handleSave() {
    setError(null);
    setSaving(true);
    setSavedCount(null);
    try {
      const rows = assetList
        .filter((a) => balances[a.id] !== "" && balances[a.id] !== undefined)
        .map((a) => ({ assetId: a.id, balance: balances[a.id] }));

      if (rows.length === 0) {
        setError("Enter at least one balance before saving.");
        return;
      }

      const res = await fetch("/api/balances/assets", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ accountId, date, rows }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        return;
      }

      const { inserted } = await res.json();
      setSavedCount(inserted);
      setBalances({});
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Step 1 — Account + Date + toggle */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-end">
        <div className="space-y-1.5">
          <Label>Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
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
          <Label htmlFor="balance-date">Date</Label>
          <Input
            id="balance-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <Switch
            id="include-all"
            checked={includeAll}
            onCheckedChange={setIncludeAll}
          />
          <Label htmlFor="include-all" className="text-sm text-muted-foreground whitespace-nowrap">
            Include inactive / expired
          </Label>
        </div>
      </div>

      {/* Step 2 — Asset balances table */}
      {accountId && (
        <>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading assets…</p>
          ) : assetList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No {includeAll ? "" : "active "}assets found for this account.
            </p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Asset</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Rule</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Expiration</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground w-40">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {assetList.map((asset, i) => (
                    <tr
                      key={asset.id}
                      className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    >
                      <td className="px-4 py-2.5 font-medium">{asset.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {asset.assetClass?.replace(/_/g, " ") ?? "—"}
                        {asset.currency !== "BRL" && (
                          <span className="ml-1.5 font-mono">{asset.currency}</span>
                        )}
                        {(!asset.isActive) && (
                          <span className="ml-1.5 text-[10px] rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 text-gray-500">inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {asset.rule ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums">
                        {asset.expirationDate
                          ? String(asset.expirationDate).slice(0, 10).split("-").reverse().join("/")
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={balances[asset.id] ?? ""}
                          onChange={(e) => setBalance(asset.id, e.target.value)}
                          className="w-36 text-right ml-auto tabular-nums"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {assetList.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {filledCount > 0
                  ? `${filledCount} of ${assetList.length} assets filled`
                  : `${assetList.length} assets — enter balances above`}
              </div>
              <div className="flex items-center gap-3">
                {error && <p className="text-sm text-destructive">{error}</p>}
                {savedCount !== null && (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {savedCount} balance{savedCount !== 1 ? "s" : ""} saved.
                  </p>
                )}
                <Button
                  variant="success"
                  disabled={saving || filledCount === 0}
                  onClick={handleSave}
                >
                  {saving ? "Saving…" : `Save ${filledCount > 0 ? filledCount : ""} balance${filledCount !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
