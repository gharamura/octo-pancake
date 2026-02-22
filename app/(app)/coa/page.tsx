import { CoaTable } from "@/components/coa-table";

export default function CoaPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Chart of Accounts</h1>
      <CoaTable />
    </div>
  );
}
