import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLoadedRepositories } from "@/app/actions/github";

export default async function CodeQuizPage() {
  const session = await auth();
  if (!session || !session.accessToken) {
    redirect("/auth");
  }

  const loadedRepos = await getLoadedRepositories();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-linear-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-linear-to-tr from-emerald-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

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
          <span className="text-lg font-bold text-zinc-900 dark:text-white">Code GeoGuessr</span>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col gap-6 px-4 py-6 md:px-6 max-w-4xl mx-auto w-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            リポジトリを選んで挑戦
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            コードの1行からファイルと行番号を特定するクイズです
          </p>
        </div>

        {loadedRepos.length === 0 ? (
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              読み取り済みのリポジトリがありません
            </p>
            <Link
              href="/repos"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              リポジトリを読み込む
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {loadedRepos.map((repo) => (
              <Link
                key={repo.id}
                href={`/code-quiz/${repo.id}`}
                className="group bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6 hover:border-blue-400 dark:hover:border-blue-500 transition-all hover:shadow-xl"
              >
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {repo.fullName}
                </h3>
                {repo.summaryJson?.summary && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2">
                    {repo.summaryJson.summary}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                    挑戦する
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
