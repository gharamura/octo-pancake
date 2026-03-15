import { AssetBalanceReport } from "@/components/asset-balance-report";

export default function AssetBalanceReportPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Asset Balance History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Latest recorded balance per asset per month.
        </p>
      </div>
      <AssetBalanceReport />
    </div>
  );
}
