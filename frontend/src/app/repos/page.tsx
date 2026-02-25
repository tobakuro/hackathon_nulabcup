import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import RepoSelector from "@/components/RepoSelector";

import type { GitHubRepo } from "@/types/github";
export default async function ReposPage() {
  const session = await auth();

  // 未ログインの場合はトップページにリダイレクト
  if (!session || !session.accessToken) {
    redirect("/auth");
  }

  // GitHub APIから自身のリポジトリ一覧を取得
  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
    // Server Componentのキャッシュをコントロール（必要に応じて"force-cache"等に変更できます）
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black p-4">
        <main className="flex flex-col items-center gap-4 bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-lg w-full max-w-2xl">
          <h1 className="text-xl font-bold text-red-500">リポジトリの取得に失敗しました</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            ステータス: {res.status} {res.statusText}
          </p>
        </main>
      </div>
    );
  }

  const repos: GitHubRepo[] = await res.json();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black p-4">
      <main className="flex flex-col gap-6 bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-lg w-full max-w-2xl">
        <div className="flex items-center justify-between border-b pb-4 dark:border-zinc-800">
          <div>
            <h1 className="text-2xl font-bold">リポジトリ分析</h1>
            <p className="text-zinc-500 text-sm mt-1">ログイン中: {session.user?.name}</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
          >
            戻る
          </Link>
        </div>

        {repos.length === 0 ? (
          <p className="text-zinc-500 py-8 text-center">リポジトリが見つかりません。</p>
        ) : (
          <RepoSelector repos={repos} accessToken={session.accessToken} />
        )}
      </main>
    </div>
  );
}
