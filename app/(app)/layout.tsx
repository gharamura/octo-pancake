import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[color:var(--color-lm-bg)] text-[color:var(--color-lm-fg)] lm-scanlines">
      <AppSidebar user={session.user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppBreadcrumb />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
