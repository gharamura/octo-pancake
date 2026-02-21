import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">
        Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}!
      </h1>
      <p className="text-muted-foreground">You are signed in as {session?.user?.email}.</p>
    </div>
  );
}
