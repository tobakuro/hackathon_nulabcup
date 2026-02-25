"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  createCodeSessionAction,
  submitCodeAnswerAction,
  type CodeQuizQuestionPublic,
  type AnswerResult,
} from "@/app/actions/code-quiz";
import FileTreePanel from "./components/FileTreePanel";
import CodeViewerPanel from "./components/CodeViewerPanel";
import QuestionPanel from "./components/QuestionPanel";
import ResultScreen from "./components/ResultScreen";
import ResizablePanes from "./components/ResizablePanes";

interface CodeQuizGameProps {
  repositoryId: string;
  repositoryName: string;
}

type GamePhase = "idle" | "loading" | "playing" | "reviewing" | "finished";

interface QuestionResult extends AnswerResult {
  questionIndex: number;
  targetLineContent: string;
}

export default function CodeQuizGame({ repositoryId, repositoryName }: CodeQuizGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<CodeQuizQuestionPublic[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(0);

  const [fileTree, setFileTree] = useState<{ filePath: string; content: string }[]>([]);
  const [currentViewingFile, setCurrentViewingFile] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedLineNumber, setSelectedLineNumber] = useState<number | null>(null);

  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const currentFileContent = currentViewingFile
    ? (fileTree.find((f) => f.filePath === currentViewingFile)?.content ?? null)
    : null;

  const startGame = useCallback(async () => {
    setGamePhase("loading");
    setError(null);
    try {
      const result = await createCodeSessionAction(repositoryId, "solo");
      if (!result) {
        setError(
          "クイズの生成に失敗しました。コードファイルが十分にないリポジトリの可能性があります。",
        );
        setGamePhase("idle");
        return;
      }
      setSessionId(result.sessionId);
      setQuestions(result.questions);
      setFileTree(result.fileTree);
      setCurrentQuestionIndex(0);
      setTotalScore(0);
      setResults([]);
      setLastResult(null);
      setCurrentViewingFile(null);
      setSelectedFilePath(null);
      setSelectedLineNumber(null);
      setQuestionStartTime(Date.now());
      setGamePhase("playing");
    } catch (err) {
      console.error("createCodeSessionAction failed:", err);
      setError("ゲームの開始に失敗しました");
      setGamePhase("idle");
    }
  }, [repositoryId]);

  const handleFileSelect = useCallback((filePath: string) => {
    setCurrentViewingFile(filePath);
    setSelectedFilePath(filePath);
    setSelectedLineNumber(null);
  }, []);

  const handleLineSelect = useCallback(
    (lineNumber: number) => {
      if (currentViewingFile) {
        setSelectedFilePath(currentViewingFile);
        setSelectedLineNumber(lineNumber);
      }
    },
    [currentViewingFile],
  );

  const handleSubmitAnswer = useCallback(async () => {
    if (!sessionId || !selectedFilePath || selectedLineNumber === null) return;
    if (gamePhase !== "playing") return;

    const audio = new Audio("/geoguessr_se.mp3");
    audio.play().catch(() => {});

    const timeSpentMs = Date.now() - questionStartTime;
    const result = await submitCodeAnswerAction(
      sessionId,
      currentQuestionIndex,
      selectedFilePath,
      selectedLineNumber,
      timeSpentMs,
    );

    const finalResult = result ?? {
      isCorrectFile: false,
      lineDifference: -1,
      score: 0,
      correctFilePath: "",
      correctLineNumber: 0,
    };

    setLastResult(finalResult);
    setTotalScore((prev) => prev + finalResult.score);
    setResults((prev) => [
      ...prev,
      {
        ...finalResult,
        questionIndex: currentQuestionIndex,
        targetLineContent: questions[currentQuestionIndex].targetLineContent,
      },
    ]);
    setGamePhase("reviewing");
  }, [
    sessionId,
    selectedFilePath,
    selectedLineNumber,
    gamePhase,
    questionStartTime,
    currentQuestionIndex,
    questions,
  ]);

  const handleSkip = useCallback(async () => {
    if (!sessionId) return;
    if (gamePhase !== "playing") return;

    const timeSpentMs = Date.now() - questionStartTime;
    const result = await submitCodeAnswerAction(
      sessionId,
      currentQuestionIndex,
      "",
      0,
      timeSpentMs,
    );

    const finalResult = result ?? {
      isCorrectFile: false,
      lineDifference: -1,
      score: 0,
      correctFilePath: "",
      correctLineNumber: 0,
    };

    setLastResult(finalResult);
    setResults((prev) => [
      ...prev,
      {
        ...finalResult,
        questionIndex: currentQuestionIndex,
        targetLineContent: questions[currentQuestionIndex].targetLineContent,
      },
    ]);
    setGamePhase("reviewing");
  }, [sessionId, gamePhase, questionStartTime, currentQuestionIndex, questions]);

  const handleNextQuestion = useCallback(() => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= questions.length) {
      setGamePhase("finished");
      return;
    }
    setCurrentQuestionIndex(nextIndex);
    setLastResult(null);
    setCurrentViewingFile(null);
    setSelectedFilePath(null);
    setSelectedLineNumber(null);
    setQuestionStartTime(Date.now());
    setGamePhase("playing");
  }, [currentQuestionIndex, questions.length]);

  if (gamePhase === "idle" || gamePhase === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-linear-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-linear-to-tr from-emerald-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
        </div>
        <div className="relative z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Code GeoGuessr</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-1">{repositoryName}</p>
          <p className="text-zinc-400 dark:text-zinc-500 text-xs mb-6">
            コードの1行が表示されます。それがどのファイルの何行目かを当ててください。
          </p>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <button
            onClick={startGame}
            disabled={gamePhase === "loading"}
            className="w-full px-6 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {gamePhase === "loading" ? "読み込み中..." : "ゲームスタート"}
          </button>
          <Link
            href="/code-quiz"
            className="block mt-4 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            リポジトリ選択に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (gamePhase === "finished") {
    return (
      <ResultScreen
        repositoryName={repositoryName}
        results={results}
        totalScore={totalScore}
        maxScore={questions.length * 400}
        onRestart={startGame}
      />
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-zinc-900 dark:text-white">Code GeoGuessr</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{repositoryName}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
            問題 <span className="font-bold">{currentQuestionIndex + 1}</span> / {questions.length}
          </span>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {totalScore} pt
          </span>
        </div>
      </header>

      {/* 3-pane layout */}
      <ResizablePanes
        left={
          <FileTreePanel
            files={fileTree}
            currentFile={currentViewingFile}
            onFileSelect={handleFileSelect}
          />
        }
        center={
          <CodeViewerPanel
            filePath={currentViewingFile}
            content={currentFileContent}
            selectedLine={selectedFilePath === currentViewingFile ? selectedLineNumber : null}
            onLineSelect={handleLineSelect}
            correctLine={
              gamePhase === "reviewing" && lastResult
                ? {
                    filePath: lastResult.correctFilePath,
                    lineNumber: lastResult.correctLineNumber,
                  }
                : null
            }
            currentViewingFile={currentViewingFile}
          />
        }
        right={
          <QuestionPanel
            question={currentQuestion}
            selectedFilePath={selectedFilePath}
            selectedLineNumber={selectedLineNumber}
            isReviewing={gamePhase === "reviewing"}
            lastResult={lastResult}
            onSubmit={handleSubmitAnswer}
            onTimeout={handleSkip}
            onNext={handleNextQuestion}
            isLastQuestion={currentQuestionIndex >= questions.length - 1}
          />
        }
      />
    </div>
  );
}
