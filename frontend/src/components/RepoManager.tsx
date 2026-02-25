"use client";

import { useState } from "react";
import type { GitHubRepo } from "@/types/github";
import type { LoadedRepository } from "@/app/actions/github";
import { getRepoLanguages, getRepoDependencies } from "@/app/actions/github";

// 言語ごとの色ドット
function LanguageDot({ language }: { language: string }) {
    const colorMap: Record<string, string> = {
        TypeScript: "#3178c6",
        JavaScript: "#f1e05a",
        Rust: "#dea584",
        Python: "#3572A5",
        Go: "#00ADD8",
        Java: "#b07219",
        Ruby: "#701516",
        PHP: "#4F5D95",
        "C++": "#f34b7d",
        C: "#555555",
        "C#": "#178600",
        Swift: "#F05138",
        Kotlin: "#A97BFF",
        Dart: "#00B4AB",
        HTML: "#e34c26",
        CSS: "#563d7c",
        Shell: "#89e051",
        Vue: "#41b883",
    };
    return (
        <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: colorMap[language] ?? "#8b949e" }}
        />
    );
}

// スター数のフォーマット
function formatStars(count: number): string {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
}

interface RepoManagerProps {
    loadedRepos: LoadedRepository[];
    unloadedRepos: GitHubRepo[];
    allGitHubRepos: GitHubRepo[];
}

export default function RepoManager({ loadedRepos: initialLoaded, unloadedRepos: initialUnloaded, allGitHubRepos }: RepoManagerProps) {
    const [loadedRepos, setLoadedRepos] = useState(initialLoaded);
    const [unloadedRepos, setUnloadedRepos] = useState(initialUnloaded);
    const [loadingId, setLoadingId] = useState<string | number | null>(null);
    const [loadStep, setLoadStep] = useState<string>("");
    const [loadProgress, setLoadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // 未読み取りリポジトリの読み取り
    const handleLoad = async (repo: GitHubRepo) => {
        setLoadingId(repo.id);
        setLoadProgress(0);
        setLoadStep("言語情報を取得中...");
        setError(null);

        try {
            const [owner, repoName] = repo.full_name.split("/");

            setLoadProgress(20);
            await getRepoLanguages(owner, repoName);

            setLoadStep("AI解析・保存中...");
            setLoadProgress(50);
            const report = await getRepoDependencies(owner, repoName, repo.default_branch);
            setLoadProgress(100);
            setLoadStep("完了!");

            setTimeout(() => {
                setUnloadedRepos((prev) => prev.filter((r) => r.id !== repo.id));
                setLoadedRepos((prev) => [
                    {
                        id: crypto.randomUUID(),
                        owner,
                        name: repoName,
                        fullName: repo.full_name,
                        summaryJson: report,
                        updatedAt: new Date(),
                    },
                    ...prev,
                ]);
                setLoadingId(null);
                setLoadProgress(0);
                setLoadStep("");
            }, 600);
        } catch (err) {
            setError(err instanceof Error ? err.message : "読み取りに失敗しました");
            setLoadingId(null);
            setLoadProgress(0);
            setLoadStep("");
        }
    };

    // 読み取り済みリポジトリの再読み込み（DB上書き）
    const handleReload = async (loaded: LoadedRepository) => {
        setLoadingId(loaded.id);
        setLoadProgress(0);
        setLoadStep("再解析中...");
        setError(null);

        try {
            // GitHub APIのdefault_branchを取得
            const ghRepo = allGitHubRepos.find((r) => r.full_name === loaded.fullName);
            const defaultBranch = ghRepo?.default_branch ?? "main";

            setLoadProgress(20);
            await getRepoLanguages(loaded.owner, loaded.name);

            setLoadStep("AI解析・保存中...");
            setLoadProgress(50);
            const report = await getRepoDependencies(loaded.owner, loaded.name, defaultBranch);
            setLoadProgress(100);
            setLoadStep("完了!");

            setTimeout(() => {
                setLoadedRepos((prev) =>
                    prev.map((r) =>
                        r.id === loaded.id
                            ? { ...r, summaryJson: report, updatedAt: new Date() }
                            : r
                    )
                );
                setLoadingId(null);
                setLoadProgress(0);
                setLoadStep("");
            }, 600);
        } catch (err) {
            setError(err instanceof Error ? err.message : "再読み込みに失敗しました");
            setLoadingId(null);
            setLoadProgress(0);
            setLoadStep("");
        }
    };

    return (
        <div className="flex flex-col gap-8">
            {/* エラー表示 */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                    <span>⚠️</span>
                    <span>{error}</span>
                    <button
                        onClick={() => setError(null)}
                        className="ml-auto text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ── 読み取り済みリポジトリ ── */}
            <section>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-500"><path d="M20 6 9 17l-5-5" /></svg>
                        読み取り済みリポジトリ
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                        {loadedRepos.length}件
                    </span>
                </div>

                {loadedRepos.length === 0 ? (
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        まだ読み取り済みのリポジトリはありません
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {loadedRepos.map((repo) => {
                            const isExpanded = expandedId === repo.id;
                            const report = repo.summaryJson;
                            return (
                                <div
                                    key={repo.id}
                                    className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                                >
                                    {/* ヘッダー行（クリックで展開） */}
                                    <div
                                        className="flex items-center justify-between p-4 cursor-pointer select-none"
                                        onClick={() => setExpandedId(isExpanded ? null : repo.id)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-emerald-600 dark:text-emerald-400"><line x1="6" x2="6" y1="3" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{repo.fullName}</p>
                                                {!isExpanded && report?.summary && (
                                                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">{report.summary}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 ml-3">
                                            <span className="px-2.5 py-0.5 text-[10px] font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                                読み取り済み
                                            </span>
                                            {loadingId === repo.id ? (
                                                <div className="flex flex-col gap-1 w-28" onClick={(e) => e.stopPropagation()}>
                                                    <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-linear-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                                                            style={{ width: `${loadProgress}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                                        <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                                                        <span className="truncate">{loadStep}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleReload(repo); }}
                                                    disabled={loadingId !== null}
                                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:border-blue-300 dark:hover:border-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" /></svg>
                                                    再読み込み
                                                </button>
                                            )}
                                            {/* 展開アイコン */}
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                                className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                            ><path d="m6 9 6 6 6-6" /></svg>
                                        </div>
                                    </div>

                                    {/* 展開コンテンツ */}
                                    {isExpanded && report && (
                                        <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 pb-4 pt-3 flex flex-col gap-4">
                                            {/* プロジェクト概要 */}
                                            <div>
                                                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
                                                    プロジェクト概要
                                                </h4>
                                                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                                    {report.summary}
                                                </p>
                                            </div>

                                            {/* アーキテクチャ */}
                                            {report.architecture && (
                                                <div>
                                                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
                                                        アーキテクチャ・設計
                                                    </h4>
                                                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                                        {report.architecture}
                                                    </p>
                                                </div>
                                            )}

                                            {/* 使用技術 */}
                                            {report.technologies && report.technologies.length > 0 && (
                                                <div>
                                                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                                                        使用技術
                                                    </h4>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {report.technologies.map((tech, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-100 dark:border-zinc-700"
                                                            >
                                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                                    <span className="font-semibold text-xs text-blue-700 dark:text-blue-300">
                                                                        {tech.name}
                                                                    </span>
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 truncate">
                                                                        {tech.purpose}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                                                                    {tech.implementation}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* 解析対象ファイル */}
                                            {report.analyzedFiles && report.analyzedFiles.length > 0 && (
                                                <div>
                                                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                                                        解析対象ファイル ({report.analyzedFiles.length})
                                                    </h4>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {report.analyzedFiles.map((file, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="px-2 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md border border-zinc-200 dark:border-zinc-700"
                                                            >
                                                                {file}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {isExpanded && !report && (
                                        <div className="border-t border-zinc-100 dark:border-zinc-800 p-4 text-center text-sm text-zinc-400 dark:text-zinc-500 italic">
                                            解析データがありません。「再読み込み」で取得してください。
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ── 未読み取りリポジトリ ── */}
            <section>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-zinc-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                        未読み取りリポジトリ
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {unloadedRepos.length}件
                    </span>
                </div>

                {unloadedRepos.length === 0 ? (
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        すべてのリポジトリが読み取り済みです 🎉
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {unloadedRepos.map((repo) => (
                            <div
                                key={repo.id}
                                className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow duration-200"
                            >
                                <div className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-zinc-400"><line x1="6" x2="6" y1="3" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{repo.full_name}</p>
                                            {repo.description && (
                                                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">{repo.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 ml-3">
                                        {/* 言語 */}
                                        {repo.language && (
                                            <div className="hidden md:flex items-center gap-1.5">
                                                <LanguageDot language={repo.language} />
                                                <span className="text-xs text-zinc-500 dark:text-zinc-400">{repo.language}</span>
                                            </div>
                                        )}
                                        {/* スター */}
                                        <div className="hidden sm:flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                            {formatStars(repo.stargazers_count)}
                                        </div>
                                        {/* 読み取るボタン / プログレス */}
                                        {loadingId === repo.id ? (
                                            <div className="flex flex-col gap-1 w-28">
                                                <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-linear-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                                                        style={{ width: `${loadProgress}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                                    <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                                                    <span className="truncate">{loadStep}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleLoad(repo)}
                                                disabled={loadingId !== null}
                                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:border-blue-300 dark:hover:border-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                                                読み取る
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
