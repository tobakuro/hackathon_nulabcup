"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  applyIncorrectRetryResult,
  saveQuizHistoryResult,
  type Difficulty,
  type QuestionResultRecord,
  type QuizPayload,
} from "@/lib/soloQuizHistory";

function formatDifficultyLabel(value: Difficulty): string {
  if (value === "easy") return "かんたん";
  if (value === "normal") return "ふつう";
  return "むずかしい";
}

export default function SoloQuizClient() {
  const [payload, setPayload] = useState<QuizPayload | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [questionResults, setQuestionResults] = useState<QuestionResultRecord[]>([]);
  const [isResultSaved, setIsResultSaved] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("solo_quiz_payload");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as QuizPayload;
      if (!parsed || !Array.isArray(parsed.quizzes) || parsed.quizzes.length === 0) return;
      setPayload(parsed);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const quizzes = payload?.quizzes ?? [];
  const currentQuiz = quizzes[currentQuestionIndex];
  const isFinished = quizzes.length > 0 && currentQuestionIndex >= quizzes.length;
  const selectedDifficultyLabel = useMemo(
    () => (payload ? formatDifficultyLabel(payload.difficulty) : "-"),
    [payload],
  );
  const isCurrentAnswerCorrect =
    !!currentQuiz &&
    selectedAnswerIndex !== null &&
    selectedAnswerIndex === currentQuiz.answerIndex;

  useEffect(() => {
    if (!payload || !isFinished || isResultSaved) return;
    const result = {
      correctCount,
      totalCount: quizzes.length,
      completedAt: Date.now(),
      questionResults,
    };

    if (payload.retryContext?.mode === "all") {
      setIsResultSaved(true);
      return;
    }

    if (payload.retryContext?.mode === "incorrect") {
      applyIncorrectRetryResult(
        payload.retryContext.sourceHistoryId,
        payload.retryContext.originalQuestionIndexes,
        questionResults,
      );
      setIsResultSaved(true);
      return;
    }

    saveQuizHistoryResult(payload, result);
    setIsResultSaved(true);
  }, [correctCount, isFinished, isResultSaved, payload, questionResults, quizzes.length]);

  function handleAnswerSelect(index: number) {
    if (showAnswer || !currentQuiz) return;
    setSelectedAnswerIndex(index);
  }

  function handleConfirmAnswer() {
    if (!currentQuiz || selectedAnswerIndex === null || showAnswer) return;
    const isCorrect = selectedAnswerIndex === currentQuiz.answerIndex;
    if (isCorrect) {
      setCorrectCount((count) => count + 1);
    }

    setQuestionResults((records) => [
      ...records,
      {
        questionIndex: currentQuestionIndex,
        selectedAnswerIndex,
        isCorrect,
      },
    ]);
    setShowAnswer(true);
  }

  function handleNextQuestion() {
    if (!showAnswer) return;
    setCurrentQuestionIndex((index) => index + 1);
    setSelectedAnswerIndex(null);
    setShowAnswer(false);
  }

  if (!payload) {
    return (
      <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">クイズデータが見つかりませんでした。</p>
        <Link
          href="/solo"
          className="inline-block mt-4 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          1人プレイ設定に戻る →
        </Link>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">クイズ終了</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          正解数: {correctCount} / {quizzes.length}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">対象: {payload.repoFullName}</p>
        <div className="mt-4 flex items-center gap-4">
          <Link href="/solo" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            1人プレイへ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {payload.repoFullName} / 難易度: {selectedDifficultyLabel} / 問題数: {payload.questionCount}
        </p>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          問題 {currentQuestionIndex + 1} / {quizzes.length} ({currentQuiz.difficulty})
        </p>
        <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">{currentQuiz.question}</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 gap-2">
          {currentQuiz.options.map((option, index) => {
            const isSelected = selectedAnswerIndex === index;
            const isCorrect = showAnswer && index === currentQuiz.answerIndex;
            const isWrongSelected = showAnswer && isSelected && !isCorrect;

            return (
              <button
                key={`${currentQuestionIndex}-${index}`}
                onClick={() => handleAnswerSelect(index)}
                className={`text-left px-3 py-2 text-xs rounded-lg border transition-colors ${
                  isCorrect
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                    : isWrongSelected
                      ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                      : isSelected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-600"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {!showAnswer ? (
          <button
            onClick={handleConfirmAnswer}
            disabled={selectedAnswerIndex === null}
            className="w-full mt-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            回答する
          </button>
        ) : (
          <>
            <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                {isCurrentAnswerCorrect ? "正解" : "不正解"}
              </p>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                正解: {currentQuiz.options[currentQuiz.answerIndex]}
              </p>
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                関連ファイル: {currentQuiz.relatedFile}
              </p>
              <div className="mt-3">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white">Tips（解説）</p>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300 font-sans">
                  {currentQuiz.tips}
                </pre>
              </div>
            </div>
            <button
              onClick={handleNextQuestion}
              className="w-full mt-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white"
            >
              次の問題へ
            </button>
          </>
        )}
      </div>
    </div>
  );
}
