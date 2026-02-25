"use client";

import { useState } from "react";
import type { GitHubRepo } from "@/types/github";
import { getRepoLanguages, getRepoDependencies, AIAnalysisReport } from "@/app/actions/github";

export default function RepoSelector({
  repos,
  accessToken,
}: {
  repos: GitHubRepo[];
  accessToken: string;
}) {
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [repoDetails, setRepoDetails] = useState<{
    repo: GitHubRepo;
    languages: { name: string; percentage: number; bytes: number }[];
    aiReport: AIAnalysisReport | null;
  } | null>(null);

  const selectedRepo = repos.find((r) => r.full_name === selectedRepoFullName);

  const handleFetchDetails = async () => {
    if (!selectedRepoFullName || !selectedRepo) return;

    setLoading(true);
    setError(null);
    setRepoDetails(null);

    try {
      const [owner, repo] = selectedRepoFullName.split("/");
      const [langs, report] = await Promise.all([
        getRepoLanguages(owner, repo, accessToken),
        getRepoDependencies(owner, repo, selectedRepo.default_branch, accessToken),
      ]);

      const totalBytes = Object.values(langs).reduce((sum, bytes) => sum + bytes, 0);

      const languagesList = Object.entries(langs)
        .map(([name, bytes]) => ({
          name,
          bytes,
          percentage: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
        }))
        .sort((a, b) => b.bytes - a.bytes);

      setRepoDetails({
        repo: selectedRepo,
        languages: languagesList,
        aiReport: report,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "詳細の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Selector Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selectedRepoFullName}
          onChange={(e) => setSelectedRepoFullName(e.target.value)}
          className="flex-1 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm"
        >
          <option value="" disabled>
            リポジトリを選択してください
          </option>
          {repos.map((repo) => (
            <option key={repo.id} value={repo.full_name}>
              {repo.name} {repo.language ? `(${repo.language})` : ""}
            </option>
          ))}
        </select>

        <button
          onClick={handleFetchDetails}
          disabled={!selectedRepoFullName || loading}
          className="px-6 py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none whitespace-nowrap flex justify-center items-center min-w-[120px]"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-sm">AI解析中...</span>
            </div>
          ) : (
            "✨ 取得・解析"
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {repoDetails && (
        <div className="flex flex-col gap-6 p-6 bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm rounded-2xl border border-zinc-200 dark:border-zinc-700">
          {/* Repo Header */}
          <header>
            <h2 className="text-2xl font-bold break-all">
              <a
                href={repoDetails.repo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {repoDetails.repo.name}
              </a>
            </h2>
            {repoDetails.repo.description && (
              <p className="mt-2 text-zinc-600 dark:text-zinc-400 text-sm">
                {repoDetails.repo.description}
              </p>
            )}
          </header>

          {/* AI Analysis Report */}
          {repoDetails.aiReport ? (
            <div className="bg-linear-to-br from-blue-50/80 to-purple-50/80 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-5 border border-blue-200/50 dark:border-blue-800/50">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">✨</span>
                <h3 className="font-bold text-blue-900 dark:text-blue-100">AI Analysis Report</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-800/60 dark:text-blue-300/60 mb-1">
                    プロジェクト概要
                  </h4>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {repoDetails.aiReport.summary}
                  </p>
                </div>

                <div className="pt-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-800/60 dark:text-blue-300/60 mb-1">
                    アーキテクチャ・設計の特徴
                  </h4>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {repoDetails.aiReport.architecture}
                  </p>
                </div>

                <div className="pt-4 border-t border-blue-200/50 dark:border-blue-800/40">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-800/60 dark:text-blue-300/60 mb-3">
                    主要技術スタック
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {repoDetails.aiReport.technologies.map((tech, idx) => (
                      <div
                        key={idx}
                        className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm p-3 rounded-xl border border-blue-100 dark:border-blue-900/50 shadow-sm hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <span className="font-bold text-sm text-blue-700 dark:text-blue-300 shrink-0">
                            {tech.name}
                          </span>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 truncate"
                            title={tech.purpose}
                          >
                            {tech.purpose}
                          </span>
                        </div>
                        <p
                          className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2"
                          title={tech.implementation}
                        >
                          {tech.implementation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Analyzed Files */}
                {repoDetails.aiReport.analyzedFiles &&
                  repoDetails.aiReport.analyzedFiles.length > 0 && (
                    <div className="pt-4 border-t border-blue-200/50 dark:border-blue-800/40">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-800/60 dark:text-blue-300/60 mb-3">
                        解析対象ファイル ({repoDetails.aiReport.analyzedFiles.length})
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {repoDetails.aiReport.analyzedFiles.map((file, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-[10px] font-mono bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800/60 break-all leading-tight"
                          >
                            {file}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 px-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-sm text-zinc-500 italic">
              <span className="text-3xl">📄</span>
              コード解析レポートは生成されませんでした
            </div>
          )}

          {/* Languages */}
          <div className="mt-2">
            <h3 className="font-semibold text-sm text-zinc-500 mb-3 uppercase tracking-wider">
              Languages
            </h3>
            {repoDetails.languages.length === 0 ? (
              <p className="text-sm text-zinc-500 italic">言語情報は検出されませんでした。</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="w-full h-3 flex rounded-full overflow-hidden shadow-inner">
                  {repoDetails.languages.map((lang, index) => (
                    <div
                      key={lang.name}
                      style={{
                        width: `${lang.percentage}%`,
                        backgroundColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
                      }}
                      title={`${lang.name}: ${lang.percentage.toFixed(1)}%`}
                      className="transition-all duration-500"
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  {repoDetails.languages.map((lang, index) => (
                    <div key={lang.name} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)` }}
                      />
                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                        {lang.name}
                      </span>
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
