import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getLoadedRepositories } from "@/app/actions/github";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth");
  }

  // 読み取り済みリポジトリがない場合はセットアップ画面へ
  const loadedRepos = await getLoadedRepositories();
  if (loadedRepos.length === 0) {
    redirect("/setup");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black overflow-hidden relative">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-linear-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-linear-to-tr from-emerald-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-linear-to-r from-purple-400/10 to-pink-400/10 rounded-full blur-3xl" />
      </div>

      <main className="relative z-10 flex flex-col items-center gap-8 w-full max-w-xl px-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
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
            GitQuiz Battle
          </h1>
        </div>

        {/* User Card */}
        <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-5">
          <div className="flex items-center gap-3">
            {session.user.image && (
              <div className="relative">
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? ""}
                  width={48}
                  height={48}
                  className="rounded-full ring-2 ring-blue-500/30 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-zinc-900" />
              </div>
            )}
            <div>
              <p className="font-semibold text-zinc-900 dark:text-white">{session.user.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">ログイン中</p>
            </div>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 gap-3 w-full">
          {/* 対戦ロビー */}
          <Link
            href="/lobby"
            className="group w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 p-5 flex items-center gap-4"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-purple-600 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200 shrink-0">
              <span className="text-xl">🎮</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-zinc-900 dark:text-white">対戦ロビー</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                対戦相手を見つけてクイズバトル
              </p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 ml-auto text-zinc-300 dark:text-zinc-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all duration-200 shrink-0"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>

          {/* 1人プレイ */}
          <Link
            href="/solo"
            className="group w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-200 p-5 flex items-center gap-4"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200 shrink-0">
              <span className="text-xl">🧠</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-zinc-900 dark:text-white">1人プレイ</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                自分のリポジトリでクイズに挑戦
              </p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 ml-auto text-zinc-300 dark:text-zinc-600 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all duration-200 shrink-0"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>

          {/* リポジトリ管理 */}
          <Link
            href="/repos"
            className="group w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-lg hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-200 p-5 flex items-center gap-4"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform duration-200 shrink-0">
              <span className="text-xl">📦</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-zinc-900 dark:text-white">リポジトリ管理</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                リポジトリの読み取り・AI解析
              </p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 ml-auto text-zinc-300 dark:text-zinc-600 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all duration-200 shrink-0"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>

        {/* Sign Out */}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
          className="w-full"
        >
          <button
            type="submit"
            className="w-full py-2.5 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm transition-all duration-200"
          >
            ログアウト
          </button>
        </form>
      </main>
    </div>
  );
}
