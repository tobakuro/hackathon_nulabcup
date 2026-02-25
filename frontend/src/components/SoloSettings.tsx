"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LoadedRepository } from "@/app/actions/github";
import { generateQuizBatchAction, type SoloDifficulty, type SoloMode } from "@/app/actions/quiz";
import { appendQuizHistory, type QuizPayload } from "@/lib/soloQuizHistory";

type Difficulty = "easy" | "normal" | "hard";
type QuestionCount = 5 | 10 | 15;

interface SoloSettingsProps {
  loadedRepos: LoadedRepository[];
  mode: SoloMode;
}

export default function SoloSettings({ loadedRepos, mode }: SoloSettingsProps) {
  const router = useRouter();
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [questionCount, setQuestionCount] = useState<QuestionCount>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const canStart = selectedRepo !== null;

  const difficultyOptions: {
    value: Difficulty;
    label: string;
    color: string;
  }[] = [
    { value: "easy", label: "かんたん", color: "emerald" },
    { value: "normal", label: "ふつう", color: "amber" },
    { value: "hard", label: "むずかしい", color: "red" },
  ];

  const countOptions: QuestionCount[] = [5, 10, 15];

  async function handleStartQuiz() {
    if (!selectedRepo || isGenerating) return;

    const repo = loadedRepos.find((item) => item.id === selectedRepo);
    if (!repo) {
      setGenerationError("リポジトリ情報の取得に失敗しました。");
      return;
    }

    const targetFiles = repo.summaryJson?.analyzedFiles ?? [];
    if (targetFiles.length === 0) {
      setGenerationError(
        "解析済みファイルが見つかりません。先にリポジトリ解析を実行してください。",
      );
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const generated = await generateQuizBatchAction(repo.owner, repo.name, "", targetFiles, {
        mode,
        difficulty: difficulty as SoloDifficulty,
        questionCount,
      });
      if (!generated || generated.quizzes.length === 0) {
        setGenerationError("クイズ生成に失敗しました。時間をおいて再実行してください。");
        return;
      }

      const payload: QuizPayload = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        quizzes: generated.quizzes,
        repoFullName: repo.fullName,
        mode,
        difficulty,
        questionCount,
        createdAt: Date.now(),
      };

      sessionStorage.setItem("solo_quiz_payload", JSON.stringify(payload));
      appendQuizHistory(payload);
      router.push("/solo/quiz");
    } catch (error) {
      console.error(error);
      setGenerationError("クイズ生成中にエラーが発生しました。");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
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
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedRepo === repo.id
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                    : "border-zinc-100 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700"
                }`}
              >
                <input
                  type="radio"
                  name="repo"
                  value={repo.id}
                  checked={selectedRepo === repo.id}
                  onChange={() => setSelectedRepo(repo.id)}
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
          {difficultyOptions.map((opt) => {
            const isSelected = difficulty === opt.value;
            const colorClasses: Record<string, { active: string; hover: string }> = {
              emerald: {
                active:
                  "border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
                hover: "hover:border-emerald-400 dark:hover:border-emerald-600",
              },
              amber: {
                active:
                  "border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
                hover: "hover:border-amber-400 dark:hover:border-amber-600",
              },
              red: {
                active:
                  "border-2 border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
                hover: "hover:border-red-400 dark:hover:border-red-600",
              },
            };
            const c = colorClasses[opt.color];
            return (
              <button
                key={opt.value}
                onClick={() => setDifficulty(opt.value)}
                className={`py-2.5 text-xs font-medium rounded-lg transition-colors ${
                  isSelected
                    ? c.active
                    : `border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 ${c.hover}`
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

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
          {countOptions.map((count) => (
            <button
              key={count}
              onClick={() => setQuestionCount(count)}
              className={`py-2.5 text-xs font-medium rounded-lg transition-colors ${
                questionCount === count
                  ? "border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                  : "border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-blue-400 dark:hover:border-blue-600"
              }`}
            >
              {count}問
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        <button
          disabled={!canStart || isGenerating}
          onClick={handleStartQuiz}
          className="w-full py-3 bg-linear-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-200 text-sm"
        >
          {isGenerating ? "クイズ生成中..." : "🚀 クイズ開始"}
        </button>
        {generationError && (
          <p className="text-center text-[11px] text-red-500 mt-2">{generationError}</p>
        )}
      </div>
    </div>
  );
}
