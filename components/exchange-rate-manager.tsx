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
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type ExchangeRateRow = {
  id:           string;
  fromCurrency: string;
  toCurrency:   string;
  rate:         string;
  date:         string;
};

const FROM_CURRENCIES = ["USD", "EUR", "GBP", "ARS", "CLP", "COP", "MXN", "UYU"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function ExchangeRateManager() {
  const [rates,   setRates]   = useState<ExchangeRateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromCurrency, setFromCurrency] = useState("USD");
  const [date,         setDate]         = useState(todayISO());
  const [rate,         setRate]         = useState("");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  function fetchRates() {
    setLoading(true);
    fetch("/api/exchange-rates")
      .then((r) => r.json())
      .then((data: ExchangeRateRow[]) => { setRates(data); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetchRates(); }, []);

  async function handleAdd() {
    if (!fromCurrency || !date || !rate) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/exchange-rates", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ fromCurrency, toCurrency: "BRL", date, rate }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setRate("");
      fetchRates();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/exchange-rates/${id}`, { method: "DELETE" });
    setRates((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Add form */}
      <div className="rounded-md border p-4 space-y-4">
        <h3 className="text-sm font-semibold">Add / Update Rate</h3>
        <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={fromCurrency} onValueChange={setFromCurrency}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FROM_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="er-date">Date</Label>
            <Input
              id="er-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="er-rate">BRL per 1 {fromCurrency}</Label>
            <Input
              id="er-rate"
              type="number"
              step="0.0001"
              min="0"
              placeholder="e.g. 5.8712"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
          </div>

          <Button
            onClick={handleAdd}
            disabled={saving || !rate || !date}
            variant="success"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          Saving a rate for an existing date will overwrite it.
        </p>
      </div>

      {/* Rates table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exchange rates recorded yet.</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Pair</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Rate</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {rates.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="px-4 py-2.5 tabular-nums">
                    {String(r.date).slice(0, 10).split("-").reverse().join("/")}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {r.fromCurrency}/{r.toCurrency}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {parseFloat(r.rate).toLocaleString("pt-BR", {
                      minimumFractionDigits: 4,
                      maximumFractionDigits: 6,
                    })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => handleDelete(r.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
