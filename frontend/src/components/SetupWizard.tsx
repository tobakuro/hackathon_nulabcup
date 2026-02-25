"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GitHubRepo } from "@/types/github";
import { getRepoDependencies } from "@/app/actions/github";

interface SetupWizardProps {
  repos: GitHubRepo[];
  fetchError?: string | null;
}

type Step = "select" | "processing" | "done" | "failed";

export default function SetupWizard({ repos, fetchError }: SetupWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("select");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRepo, setCurrentRepo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStart = async () => {
    if (selectedIds.size === 0) return;

    setStep("processing");
    setError(null);

    const selectedRepos = repos.filter((r) => selectedIds.has(r.id));
    const errors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < selectedRepos.length; i++) {
      const repo = selectedRepos[i];
      const [owner, repoName] = repo.full_name.split("/");
      setCurrentRepo(repo.full_name);

      try {
        await getRepoDependencies(owner, repoName, repo.default_branch);
        successCount++;
      } catch (err) {
        errors.push(`${repo.full_name}: ${err instanceof Error ? err.message : "不明なエラー"}`);
      }

      setCurrentIndex(i + 1);
    }

    if (errors.length > 0) {
      setError(errors.join("\n"));
    }
    setStep(successCount > 0 ? "done" : "failed");
  };

  // ステップ1: リポジトリ選択
  if (step === "select") {
    return (
      <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
            📦 リポジトリを選択
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            クイズで使用するリポジトリを1つ以上選択してください。AIが解析して問題を生成します。
          </p>
          {fetchError && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400">{fetchError}</p>
            </div>
          )}
        </div>

        <div className="p-4 max-h-80 overflow-y-auto">
          <div className="flex flex-col gap-2">
            {repos.map((repo) => {
              const isSelected = selectedIds.has(repo.id);
              return (
                <button
                  key={repo.id}
                  onClick={() => toggleSelection(repo.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-150 ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500/30"
                      : "border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "border-blue-500 bg-blue-500"
                          : "border-zinc-300 dark:border-zinc-600"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-3 h-3"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                        {repo.full_name}
                      </p>
                      {repo.description && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
                          {repo.description}
                        </p>
                      )}
                    </div>
                    {repo.language && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
                        {repo.language}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={handleStart}
            disabled={selectedIds.size === 0}
            className="w-full py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 text-sm"
          >
            {selectedIds.size === 0
              ? "リポジトリを選択してください"
              : `${selectedIds.size} 件のリポジトリを読み取る`}
          </button>
        </div>
      </div>
    );
  }

  // ステップ2: 処理中
  if (step === "processing") {
    const total = selectedIds.size;
    const progress = Math.round((currentIndex / total) * 100);

    return (
      <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-8">
        <div className="flex flex-col items-center gap-6">
          {/* Spinner */}
          <div className="relative">
            <div className="w-16 h-16 border-4 border-zinc-200 dark:border-zinc-700 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-500 rounded-full animate-spin" />
          </div>

          <div className="text-center">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
              リポジトリを解析中...
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{currentRepo}</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              {currentIndex} / {total} 処理済み
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {error && (
            <div className="w-full p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center">
            AIがソースコードを解析しています。数十秒かかる場合があります。
          </p>
        </div>
      </div>
    );
  }

  // ステップ3: 完了 / 全件失敗
  const isFailed = step === "failed";

  return (
    <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-8">
      <div className="flex flex-col items-center gap-6">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center ${
            isFailed ? "bg-red-100 dark:bg-red-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"
          }`}
        >
          {isFailed ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8 text-red-600 dark:text-red-400"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" x2="9" y1="9" y2="15" />
              <line x1="9" x2="15" y1="9" y2="15" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8 text-emerald-600 dark:text-emerald-400"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </div>

        <div className="text-center">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
            {isFailed ? "セットアップに失敗しました" : "セットアップ完了！"}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isFailed ? (
              "すべてのリポジトリの読み取りに失敗しました。もう一度お試しください。"
            ) : (
              <>
                {selectedIds.size} 件のリポジトリの解析が完了しました。
                <br />
                さっそくクイズに挑戦しましょう！
              </>
            )}
          </p>
        </div>

        {error && (
          <div
            className={`w-full p-3 rounded-lg border ${
              isFailed
                ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
            }`}
          >
            <p
              className={`text-xs whitespace-pre-line ${
                isFailed ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {isFailed ? error : `⚠️ 一部のリポジトリで問題が発生しました:\n${error}`}
            </p>
          </div>
        )}

        {isFailed ? (
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all duration-200 text-sm"
          >
            やり直す
          </button>
        ) : (
          <button
            onClick={() => router.push("/home")}
            className="w-full py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all duration-200 text-sm"
          >
            ホームへ進む →
          </button>
        )}
      </div>
    </div>
  );
}
