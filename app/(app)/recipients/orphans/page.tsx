import { OrphanRecipients } from "@/components/orphan-recipients";

export default function OrphanRecipientsPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Orphan Recipients</h1>
        <p className="text-sm text-muted-foreground">
          Transaction descriptions with no linked recipient record.
        </p>
      </div>
      <OrphanRecipients />
    </div>
  );
}
