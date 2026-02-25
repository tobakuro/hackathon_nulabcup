"use client";

import Link from "next/link";
import type { AnswerResult } from "@/app/actions/code-quiz";

interface QuestionResult extends AnswerResult {
  questionIndex: number;
  targetLineContent: string;
}

interface ResultScreenProps {
  repositoryName: string;
  results: QuestionResult[];
  totalScore: number;
  maxScore: number;
  onRestart: () => void;
}

function getScoreRank(totalScore: number, maxScore: number): { label: string; color: string } {
  const ratio = totalScore / maxScore;
  if (ratio >= 0.9) return { label: "S", color: "text-yellow-500" };
  if (ratio >= 0.7) return { label: "A", color: "text-emerald-500" };
  if (ratio >= 0.5) return { label: "B", color: "text-blue-500" };
  if (ratio >= 0.3) return { label: "C", color: "text-orange-500" };
  return { label: "D", color: "text-red-500" };
}

export default function ResultScreen({
  repositoryName,
  results,
  totalScore,
  maxScore,
  onRestart,
}: ResultScreenProps) {
  const rank = getScoreRank(totalScore, maxScore);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-linear-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-linear-to-tr from-emerald-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      <main className="relative z-10 flex flex-1 flex-col items-center gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
        {/* Score Card */}
        <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Result</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{repositoryName}</p>

          <div className={`text-6xl font-black mb-2 ${rank.color}`}>{rank.label}</div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white">
            {totalScore} <span className="text-lg text-zinc-400">/ {maxScore}</span>
          </p>
        </div>

        {/* Question Breakdown */}
        <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">問題詳細</h2>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {results.map((r) => (
              <div key={r.questionIndex} className="px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Q{r.questionIndex + 1}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      r.score > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                    }`}
                  >
                    {r.score > 0 ? `+${r.score}` : "0"} pt
                  </span>
                </div>
                <div className="bg-zinc-900 dark:bg-zinc-800 rounded p-2 mb-2 overflow-x-auto">
                  <pre className="text-xs font-mono text-emerald-400 whitespace-pre">
                    {r.targetLineContent}
                  </pre>
                </div>
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  正解: {r.correctFilePath}:{r.correctLineNumber}
                </p>
                {r.isCorrectFile ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {r.lineDifference === 0 ? "完全正解" : `ファイル正解 (${r.lineDifference}行差)`}
                  </p>
                ) : (
                  <p className="text-xs text-red-500">不正解</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <button
            onClick={onRestart}
            className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            もう一度
          </button>
          <Link
            href="/code-quiz"
            className="flex-1 px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium text-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            リポジトリ選択
          </Link>
        </div>
      </main>
    </div>
  );
}
