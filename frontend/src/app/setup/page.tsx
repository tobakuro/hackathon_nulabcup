import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLoadedRepositories } from "@/app/actions/github";
import type { GitHubRepo } from "@/types/github";
import SetupWizard from "@/components/SetupWizard";

export default async function SetupPage() {
  const session = await auth();

  if (!session?.user || !session.accessToken) {
    redirect("/auth");
  }

  // 既に読み取り済みリポジトリがあればホームへ
  const loadedRepos = await getLoadedRepositories();
  if (loadedRepos.length > 0) {
    redirect("/home");
  }

  // GitHub APIからリポジトリ一覧を取得
  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
    cache: "no-store",
  });

  let repos: GitHubRepo[] = [];
  let fetchError: string | null = null;
  if (res.ok) {
    repos = await res.json();
  } else {
    fetchError = `GitHubリポジトリの取得に失敗しました (${res.status} ${res.statusText})`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-linear-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-linear-to-tr from-emerald-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      <main className="relative z-10 flex flex-col items-center gap-6 w-full max-w-lg px-6">
        {/* Welcome Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
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
            はじめましょう！
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            まず、クイズに使用するリポジトリを選択します。
            <br />
            選択したリポジトリをAIが解析して問題を生成します。
          </p>
        </div>

        <SetupWizard repos={repos} fetchError={fetchError} />
      </main>
    </div>
  );
}
