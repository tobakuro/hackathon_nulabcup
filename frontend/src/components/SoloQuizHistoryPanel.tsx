"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearQuizHistory,
  deleteQuizHistoryByIds,
  loadQuizHistory,
  type Difficulty,
  type QuestionResultRecord,
  type QuizHistoryItem,
  type QuizPayload,
  type RetryMode,
} from "@/lib/soloQuizHistory";

function formatDifficultyLabel(value: Difficulty): string {
  if (value === "easy") return "かんたん";
  if (value === "normal") return "ふつう";
  return "むずかしい";
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function renderQuestionList(
  item: QuizHistoryItem,
  records: QuestionResultRecord[],
  title: string,
  borderClass: string,
) {
  return (
    <div className={`rounded-lg border ${borderClass} p-3`}>
      <p className="text-xs font-semibold text-zinc-900 dark:text-white">
        {title}
      </p>
      {records.length === 0 ? (
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          該当なし
        </p>
      ) : (
        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
          {records.map((record, idx) => {
            const quiz = item.quizzes[record.questionIndex];
            if (!quiz) return null;
            const selected =
              quiz.options[record.selectedAnswerIndex] ?? "未回答";
            const correct = quiz.options[quiz.answerIndex] ?? "-";
            return (
              <article
                key={`${item.id}-${record.questionIndex}-${idx}`}
                className="rounded-md border border-zinc-200 dark:border-zinc-700 p-2"
              >
                <p className="text-xs font-medium text-zinc-900 dark:text-white">
                  Q{record.questionIndex + 1}. {quiz.question}
                </p>
                <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                  あなたの解答: {selected}
                </p>
                <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                  正解: {correct}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  解説: {quiz.tips}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SoloQuizHistoryPanel() {
  const router = useRouter();
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setHistory(loadQuizHistory());
  }, []);

  const hasItems = history.length > 0;
  const latestItems = useMemo(() => {
    if (showAll) return history.slice(0, 20);
    return history.slice(0, 5);
  }, [history, showAll]);

  function handleClearHistory() {
    clearQuizHistory();
    setHistory([]);
    setSelectedIds([]);
    setShowAll(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id],
    );
  }

  function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    deleteQuizHistoryByIds(selectedIds);
    const nextHistory = loadQuizHistory();
    setHistory(nextHistory);
    setSelectedIds([]);
    if (nextHistory.length <= 5) {
      setShowAll(false);
    }
  }

  function createRetryPayload(
    item: QuizHistoryItem,
    mode: RetryMode,
    originalQuestionIndexes: number[],
    quizzes: QuizHistoryItem["quizzes"],
  ): QuizPayload {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      quizzes,
      repoFullName: item.repoFullName,
      mode: item.mode,
      difficulty: item.difficulty,
      questionCount: quizzes.length,
      createdAt: Date.now(),
      retryContext: {
        sourceHistoryId: item.id,
        mode,
        originalQuestionIndexes,
      },
    };
  }

  function handleRetry(item: QuizHistoryItem, mode: RetryMode) {
    const incorrectQuestionIndexes =
      item.result?.questionResults
        ?.filter((record) => !record.isCorrect)
        .map((record) => record.questionIndex) ?? [];

    const retryIndexes =
      mode === "all"
        ? item.quizzes.map((_, index) => index)
        : incorrectQuestionIndexes;
    const retryQuizzes = retryIndexes
      .map((index) => item.quizzes[index])
      .filter((quiz): quiz is QuizHistoryItem["quizzes"][number] =>
        Boolean(quiz),
      );

    if (retryQuizzes.length === 0) return;

    const payload = createRetryPayload(item, mode, retryIndexes, retryQuizzes);
    sessionStorage.setItem("solo_quiz_payload", JSON.stringify(payload));
    router.push("/solo/quiz");
  }

  return (
    <section className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            クイズ履歴
          </h2>
          {selectedIds.length > 0 && (
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {selectedIds.length} 件を選択中
            </p>
          )}
        </div>
        {hasItems && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0}
              className="text-[11px] text-zinc-500 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              選択削除
            </button>
            <button
              onClick={handleClearHistory}
              className="text-[11px] text-zinc-500 hover:text-red-500 transition-colors"
            >
              すべて削除
            </button>
          </div>
        )}
      </div>

      {!hasItems ? (
        <p className="p-5 text-xs text-zinc-500 dark:text-zinc-400">
          まだ履歴がありません。クイズを作成するとここに表示されます。
        </p>
      ) : (
        <div className="p-3 flex flex-col gap-2 max-h-[24rem] overflow-y-auto">
          {history.length > 5 && (
            <div className="px-1 pb-1">
              <button
                onClick={() => setShowAll((current) => !current)}
                className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              >
                {showAll
                  ? "表示を減らす"
                  : `もっと見る（残り${Math.max(history.length - 5, 0)}件）`}
              </button>
            </div>
          )}

          {latestItems.map((item) => {
            const correctRecords =
              item.result?.questionResults?.filter(
                (record) => record.isCorrect,
              ) ?? [];
            const incorrectRecords =
              item.result?.questionResults?.filter(
                (record) => !record.isCorrect,
              ) ?? [];

            return (
              <article
                key={item.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/60"
              >
                <div className="p-3">
                  <label className="inline-flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="accent-red-500"
                    />
                    選択
                  </label>

                  <div className="mt-2 min-w-0">
                    <p className="text-xs font-medium text-zinc-900 dark:text-white truncate">
                      {item.repoFullName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                        {item.mode === "tech" ? "テック" : "プロダクト"}
                      </span>
                      <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                        {formatDifficultyLabel(item.difficulty)}
                      </span>
                      <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                        {item.questionCount}問
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      作成: {formatDate(item.createdAt)}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {item.result
                        ? `結果: ${item.result.correctCount}/${item.result.totalCount}`
                        : "結果: 未完了"}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleRetry(item, "all")}
                      className="text-[11px] px-3 py-1.5 rounded-md border border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    >
                      全問再挑戦
                    </button>
                    <button
                      onClick={() => handleRetry(item, "incorrect")}
                      disabled={incorrectRecords.length === 0}
                      className="text-[11px] px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      不正解のみ再挑戦
                    </button>
                  </div>
                </div>

                <details className="border-t border-zinc-200 dark:border-zinc-700">
                  <summary className="cursor-pointer list-none p-3 text-[11px] text-blue-600 dark:text-blue-400">
                    問題・解答・解説を見る
                  </summary>
                  <div className="px-3 pb-3 space-y-3 max-h-80 overflow-y-auto">
                    {!item.result ? (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        このクイズはまだ完了していません。
                      </p>
                    ) : (
                      <>
                        {renderQuestionList(
                          item,
                          correctRecords,
                          `正解した問題 (${correctRecords.length})`,
                          "border-emerald-300 dark:border-emerald-700",
                        )}
                        {renderQuestionList(
                          item,
                          incorrectRecords,
                          `不正解の問題 (${incorrectRecords.length})`,
                          "border-red-300 dark:border-red-700",
                        )}
                      </>
                    )}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
