import { AssetPerformanceDashboard } from "@/components/asset-performance-dashboard";

export default function AssetPerformancePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Asset Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Month-by-month balance evolution, cash flows, and return analysis across your portfolio.
        </p>
      </div>
      <AssetPerformanceDashboard />
    </div>
  );
}
