"use client";

import { useState } from "react";
import type { GitHubRepo } from "@/app/repos/page.tsx";
import { getRepoLanguages } from "@/app/actions/github";

export default function RepoSelector({
    repos,
    accessToken
}: {
    repos: GitHubRepo[],
    accessToken: string
}) {
    const [selectedRepoFullName, setSelectedRepoFullName] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [repoDetails, setRepoDetails] = useState<{
        repo: GitHubRepo;
        languages: { name: string; percentage: number; bytes: number }[];
    } | null>(null);

    // 選択されたリポジトリのオブジェクトを取得
    const selectedRepo = repos.find(r => r.full_name === selectedRepoFullName);

    const handleFetchDetails = async () => {
        if (!selectedRepoFullName || !selectedRepo) return;

        setLoading(true);
        setError(null);
        setRepoDetails(null);

        try {
            // Server Actionを使って言語ごとのバイト数を取得
            const [owner, repo] = selectedRepoFullName.split("/");
            const langs = await getRepoLanguages(owner, repo, accessToken);

            // 合計バイト数を計算して割合(%)を出す
            const totalBytes = Object.values(langs).reduce((sum, bytes) => sum + bytes, 0);

            const languagesList = Object.entries(langs)
                .map(([name, bytes]) => ({
                    name,
                    bytes,
                    percentage: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0
                }))
                .sort((a, b) => b.bytes - a.bytes); // 多い順に並び替え

            setRepoDetails({
                repo: selectedRepo,
                languages: languagesList
            });

        } catch (err) {
            setError(err instanceof Error ? err.message : "詳細の取得に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row gap-3">
                <select
                    value={selectedRepoFullName}
                    onChange={(e) => setSelectedRepoFullName(e.target.value)}
                    className="flex-1 p-3 border rounded-lg bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition"
                >
                    <option value="" disabled>リポジトリを選択してください</option>
                    {repos.map((repo) => (
                        <option key={repo.id} value={repo.full_name}>
                            {repo.name} {repo.language ? `(${repo.language})` : ""}
                        </option>
                    ))}
                </select>

                <button
                    onClick={handleFetchDetails}
                    disabled={!selectedRepoFullName || loading}
                    className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed whitespace-nowrap flex justify-center items-center min-w-[120px]"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        "取得"
                    )}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {repoDetails && (
                <div className="flex flex-col gap-4 p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border dark:border-zinc-700 animate-in fade-in zoom-in-95 duration-200">
                    <div>
                        <h2 className="text-xl font-bold break-all">
                            <a
                                href={repoDetails.repo.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline hover:text-blue-600 dark:hover:text-blue-400"
                            >
                                {repoDetails.repo.name}
                            </a>
                        </h2>
                        <p className="mt-2 text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed">
                            {repoDetails.repo.description ? repoDetails.repo.description : <span className="text-zinc-400 italic">No description provided.</span>}
                        </p>
                    </div>

                    <div className="mt-2">
                        <h3 className="font-semibold text-sm text-zinc-500 mb-3 uppercase tracking-wider">Languages</h3>

                        {repoDetails.languages.length === 0 ? (
                            <p className="text-sm text-zinc-500 italic">言語情報は検出されませんでした。</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {/* 割合バー */}
                                <div className="w-full h-3 flex rounded-full overflow-hidden">
                                    {repoDetails.languages.map((lang, index) => (
                                        <div
                                            key={lang.name}
                                            style={{
                                                width: `${lang.percentage}%`,
                                                backgroundColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)`
                                            }}
                                            title={`${lang.name}: ${lang.percentage.toFixed(1)}%`}
                                        />
                                    ))}
                                </div>

                                {/* 凡例リスト */}
                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                                    {repoDetails.languages.map((lang, index) => (
                                        <div key={lang.name} className="flex items-center gap-1.5">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)` }}
                                            ></div>
                                            <span className="font-medium text-zinc-700 dark:text-zinc-200">{lang.name}</span>
                                            <span className="text-zinc-500">{lang.percentage.toFixed(1)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
