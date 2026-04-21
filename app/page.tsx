import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white dark:bg-black">
      <Image src="/logo.png" alt="CH Personal Finance" width={160} height={160} priority />
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">CH Personal Finance</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Capistrano Haramura</p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/auth/sign-in"
          className="rounded-full bg-black px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Sign in
        </Link>
        <Link
          href="/auth/sign-up"
          className="rounded-full border border-zinc-300 px-6 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
