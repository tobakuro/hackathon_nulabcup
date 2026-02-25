import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getLoadedRepositories } from "@/app/actions/github";
import type { LoadedRepository } from "@/app/actions/github";

export default async function SoloPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/auth");
    }

    let loadedRepos: LoadedRepository[] = [];
    try {
        loadedRepos = await getLoadedRepositories();
    } catch {
        // DB未接続時は空配列
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

                {/* Main Card */}
                <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    {/* リポジトリ選択 */}
                    <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4 text-emerald-500"
                            >
                                <line x1="6" x2="6" y1="3" y2="15" />
                                <circle cx="18" cy="6" r="3" />
                                <circle cx="6" cy="18" r="3" />
                                <path d="M18 9a9 9 0 0 1-9 9" />
                            </svg>
                            リポジトリを選択
                        </h2>
                        {loadedRepos.length === 0 ? (
                            <div className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
                                <p>読み取り済みのリポジトリがありません</p>
                                <Link
                                    href="/repos"
                                    className="inline-block mt-2 text-blue-600 dark:text-blue-400 hover:underline text-xs"
                                >
                                    リポジトリ管理 →
                                </Link>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                                {loadedRepos.map((repo) => (
                                    <label
                                        key={repo.id}
                                        className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="radio"
                                            name="repo"
                                            value={repo.id}
                                            className="accent-emerald-500"
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                                                {repo.fullName}
                                            </p>
                                            {repo.summaryJson?.summary && (
                                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
                                                    {repo.summaryJson.summary}
                                                </p>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 難易度選択 */}
                    <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4 text-amber-500"
                            >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                            難易度
                        </h2>
                        <div className="grid grid-cols-3 gap-2">
                            <button className="py-2.5 text-xs font-medium rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 transition-colors">
                                かんたん
                            </button>
                            <button className="py-2.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-amber-400 dark:hover:border-amber-600 transition-colors">
                                ふつう
                            </button>
                            <button className="py-2.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-red-400 dark:hover:border-red-600 transition-colors">
                                むずかしい
                            </button>
                        </div>
                    </div>

                    {/* 問題数 */}
                    <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4 text-blue-500"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
                            </svg>
                            問題数
                        </h2>
                        <div className="grid grid-cols-3 gap-2">
                            <button className="py-2.5 text-xs font-medium rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 transition-colors">
                                5問
                            </button>
                            <button className="py-2.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
                                10問
                            </button>
                            <button className="py-2.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
                                15問
                            </button>
                        </div>
                    </div>

                    {/* Start Button */}
                    <div className="p-6">
                        <button
                            disabled
                            className="w-full py-3 bg-linear-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm"
                        >
                            🚀 クイズ開始（準備中）
                        </button>
                        <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">
                            この機能は現在開発中です
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
