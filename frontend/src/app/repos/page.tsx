import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import RepoManager from "@/components/RepoManager";
import { getLoadedRepositories } from "@/app/actions/github";

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

  const allGitHubRepos: GitHubRepo[] = await res.json();

  // DBから読み取り済みリポジトリを取得
  const loadedRepos = await getLoadedRepositories();
  const loadedFullNames = new Set(loadedRepos.map((r) => r.fullName));

  // 未読み取り = GitHub上にあるがDBに未登録
  const unloadedRepos = allGitHubRepos.filter((r) => !loadedFullNames.has(r.full_name));

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black overflow-hidden relative">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-linear-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-linear-to-tr from-emerald-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 md:px-6 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm">
        <Link
          href="/lobby"
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
          <span className="text-lg">📦</span>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">リポジトリ管理</h1>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col gap-8 px-4 py-6 md:px-6 max-w-4xl mx-auto w-full">
        <RepoManager
          loadedRepos={loadedRepos}
          unloadedRepos={unloadedRepos}
          allGitHubRepos={allGitHubRepos}
        />
      </main>
    </div>
  );
}
