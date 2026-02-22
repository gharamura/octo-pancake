import { RecipientTable } from "@/components/recipient-table";

export default function RecipientsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Recipients</h1>
      <RecipientTable />
    </div>
  );
}
