import { ExchangeRateManager } from "@/components/exchange-rate-manager";

export default function ExchangeRatesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Exchange Rates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage currency → BRL rates used to value non-BRL assets in the balance history report.
        </p>
      </div>
      <ExchangeRateManager />
    </div>
  );
}
