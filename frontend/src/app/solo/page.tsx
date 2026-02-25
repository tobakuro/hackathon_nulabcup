import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SoloPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-linear-to-br from-emerald-400/20 to-teal-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-linear-to-tr from-blue-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      <main className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-6">
        {/* Header */}
        <div className="w-full flex items-center justify-between">
          <Link
            href="/home"
            className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            戻る
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              1人プレイ
            </h1>
          </div>
          <div className="w-12" />
        </div>

        <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">モードを選択</h2>
          </div>
          <div className="p-6 grid grid-cols-1 gap-3">
            <Link
              href="/solo/setup?mode=tech"
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 hover:border-violet-400 dark:hover:border-violet-600 transition-colors"
            >
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">テックモード</p>
            </Link>
            <Link
              href="/solo/setup?mode=product"
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 hover:border-violet-400 dark:hover:border-violet-600 transition-colors"
            >
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">プロダクトモード</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
