"use client";

import { useState, useEffect, useRef } from "react";
import type { CodeQuizQuestionPublic, AnswerResult } from "@/app/actions/code-quiz";

const TIME_LIMIT = 60;

interface QuestionPanelProps {
  question: CodeQuizQuestionPublic;
  selectedFilePath: string | null;
  selectedLineNumber: number | null;
  isReviewing: boolean;
  lastResult: AnswerResult | null;
  onSubmit: () => void;
  onTimeout: () => void;
  onNext: () => void;
  isLastQuestion: boolean;
}

export default function QuestionPanel({
  question,
  selectedFilePath,
  selectedLineNumber,
  isReviewing,
  lastResult,
  onSubmit,
  onTimeout,
  onNext,
  isLastQuestion,
}: QuestionPanelProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(TIME_LIMIT);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isReviewing) return;
    setRemainingSeconds(TIME_LIMIT);
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setTimeout(onTimeout, 0);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isReviewing, question.questionIndex, onTimeout]);

  const canSubmit = selectedFilePath !== null && selectedLineNumber !== null && !isReviewing;

  return (
    <div className="p-4 flex flex-col gap-4 h-full">
      {/* Timer */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {question.hint.language}
        </span>
        {!isReviewing ? (
          <span
            className={`text-sm font-mono font-bold tabular-nums ${
              remainingSeconds <= 10
                ? "text-red-500 animate-pulse"
                : remainingSeconds <= 30
                  ? "text-yellow-500"
                  : "text-zinc-600 dark:text-zinc-300"
            }`}
          >
            {remainingSeconds}s
          </span>
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">終了</span>
        )}
      </div>

      {/* Question */}
      <div>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">この行はどこ?</p>
        <div className="bg-zinc-900 dark:bg-zinc-800 rounded-lg p-3 overflow-x-auto">
          <pre className="text-sm font-mono text-emerald-400 whitespace-pre">
            {question.targetLineContent}
          </pre>
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
          {question.hint.totalFiles} ファイルの中から探してください
        </p>
      </div>

      {/* Selection */}
      <div>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">回答</p>
        {selectedFilePath && selectedLineNumber !== null ? (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm font-mono text-blue-700 dark:text-blue-300 truncate">
              {selectedFilePath}
            </p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              Line {selectedLineNumber}
            </p>
          </div>
        ) : (
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 text-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">ファイルを開いて行をクリック</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isReviewing ? (
        <div className="flex flex-col gap-2 mt-auto">
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            回答する
          </button>
        </div>
      ) : (
        <div className="mt-auto">
          {/* Result */}
          {lastResult && (
            <div
              className={`rounded-lg p-4 mb-3 ${
                lastResult.isCorrectFile
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              }`}
            >
              <p
                className={`text-lg font-bold mb-1 ${
                  lastResult.isCorrectFile
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {lastResult.score > 0 ? `+${lastResult.score} pt` : "0 pt"}
              </p>
              {lastResult.isCorrectFile ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  {lastResult.lineDifference === 0
                    ? "完全正解!"
                    : `ファイル正解! (${lastResult.lineDifference}行差)`}
                </p>
              ) : (
                <p className="text-sm text-red-700 dark:text-red-300">ファイルが違います</p>
              )}
              <div className="mt-2 pt-2 border-t border-current/10">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">正解:</p>
                <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate">
                  {lastResult.correctFilePath}:{lastResult.correctLineNumber}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={onNext}
            className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {isLastQuestion ? "結果を見る" : "次の問題"}
          </button>
        </div>
      )}
    </div>
  );
}
