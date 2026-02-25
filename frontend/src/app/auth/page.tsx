import AuthButtons from "@/components/AuthButtons";
import Link from "next/link";
import { Suspense } from "react";

export default function AuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black overflow-hidden relative">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-linear-to-br from-red-400/20 to-rose-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-linear-to-tr from-emerald-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      <main className="relative z-10 flex flex-col items-center gap-8 w-full max-w-md px-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/25">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8"
            >
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            GitQuiz Battle
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">GitHubアカウントでログイン</p>
        </div>

        {/* Auth Card */}
        <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800">
          <Suspense
            fallback={
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-8 h-8 border-4 border-zinc-200 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400 rounded-full animate-spin" />
                <p className="text-sm text-zinc-500">読み込み中...</p>
              </div>
            }
          >
            <AuthButtons />
          </Suspense>
        </div>

        {/* Back Link */}
        <Link
          href="/"
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          ← トップページに戻る
        </Link>
      </main>
    </div>
  );
}
