import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import RepoSelector from "@/components/RepoSelector";

import type { GitHubRepo } from "@/types/github";
export default async function ReposPage() {
  const session = await auth();

  // 未ログインの場合は認証ページにリダイレクト
  if (!session || !session.accessToken) {
    redirect("/auth");
  }

  // GitHub APIから自身のリポジトリ一覧を取得
  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black overflow-hidden relative p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-linear-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-linear-to-tr from-emerald-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
        </div>
        <main className="relative z-10 flex flex-col items-center gap-6 w-full max-w-2xl">
          <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-col items-center gap-4">
              <span className="text-4xl">⚠️</span>
              <h1 className="text-xl font-bold text-red-500">リポジトリの取得に失敗しました</h1>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                ステータス: {res.status} {res.statusText}
              </p>
            </div>
          </div>
          <Link
            href="/lobby"
            className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            ← ロビーに戻る
          </Link>
        </main>
      </div>
    );
  }

  const repos: GitHubRepo[] = await res.json();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black overflow-hidden relative p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-linear-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-linear-to-tr from-emerald-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      <main className="relative z-10 flex flex-col items-center gap-6 w-full max-w-2xl">
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            📦 リポジトリ分析
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            リポジトリを選んでAI解析を実行
          </p>
        </div>

        {/* Main Card */}
        <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {/* User Info Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-900 dark:text-white">{session.user?.name}</span> のリポジトリ
            </p>
            <Link
              href="/lobby"
              className="px-4 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-200"
            >
              ← 戻る
            </Link>
          </div>

          {/* Content */}
          <div className="p-6">
            {repos.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <span className="text-4xl">📭</span>
                <p className="text-zinc-500 dark:text-zinc-400">リポジトリが見つかりません。</p>
              </div>
            ) : (
              <RepoSelector repos={repos} accessToken={session.accessToken} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
