import { AssetBalanceEntry } from "@/components/asset-balance-entry";

export default function AssetBalancesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Asset Balances</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select an account, enter the balance for each asset, and save.
        </p>
      </div>
      <AssetBalanceEntry />
    </div>
  );
}
