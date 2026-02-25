import type { QuizQuestion, SoloMode } from "@/app/actions/quiz";

export type Difficulty = "easy" | "normal" | "hard";
export type QuestionCount = number;
export type RetryMode = "all" | "incorrect";

export interface QuizPayload {
  id: string;
  quizzes: QuizQuestion[];
  repoFullName: string;
  mode: SoloMode;
  difficulty: Difficulty;
  questionCount: QuestionCount;
  createdAt: number;
  retryContext?: {
    sourceHistoryId: string;
    mode: RetryMode;
    originalQuestionIndexes: number[];
  };
}

export interface QuestionResultRecord {
  questionIndex: number;
  selectedAnswerIndex: number;
  isCorrect: boolean;
}

export interface QuizHistoryResult {
  correctCount: number;
  totalCount: number;
  completedAt: number;
  questionResults: QuestionResultRecord[];
}

export interface QuizHistoryItem extends QuizPayload {
  result?: QuizHistoryResult;
}

const HISTORY_STORAGE_KEY = "solo_quiz_history";
const HISTORY_MAX_ITEMS = 20;

function isValidQuizQuestion(value: unknown): value is QuizQuestion {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<QuizQuestion>;
  return (
    typeof candidate.question === "string" &&
    Array.isArray(candidate.options) &&
    typeof candidate.answerIndex === "number"
  );
}

function isValidQuizHistoryItem(value: unknown): value is QuizHistoryItem {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<QuizHistoryItem>;
  return (
    typeof candidate.id === "string" &&
    Array.isArray(candidate.quizzes) &&
    candidate.quizzes.every((quiz) => isValidQuizQuestion(quiz))
  );
}

export function loadQuizHistory(): QuizHistoryItem[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as QuizHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is QuizHistoryItem =>
      isValidQuizHistoryItem(item),
    );
  } catch {
    return [];
  }
}

function saveQuizHistory(items: QuizHistoryItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
}

export function appendQuizHistory(payload: QuizPayload) {
  const current = loadQuizHistory();
  const next = [payload, ...current].slice(0, HISTORY_MAX_ITEMS);
  saveQuizHistory(next);
}

export function saveQuizHistoryResult(
  payload: QuizPayload,
  result: QuizHistoryResult,
) {
  const current = loadQuizHistory();
  const existingIndex = current.findIndex((item) => item.id === payload.id);

  if (existingIndex >= 0) {
    const next = current.map((item) =>
      item.id === payload.id
        ? {
            ...item,
            result,
          }
        : item,
    );
    saveQuizHistory(next);
    return;
  }

  const next = [{ ...payload, result }, ...current].slice(0, HISTORY_MAX_ITEMS);
  saveQuizHistory(next);
}

export function applyIncorrectRetryResult(
  sourceHistoryId: string,
  originalQuestionIndexes: number[],
  retryQuestionResults: QuestionResultRecord[],
) {
  const current = loadQuizHistory();
  const source = current.find((item) => item.id === sourceHistoryId);
  if (!source?.result) return;

  const byQuestionIndex = new Map<number, QuestionResultRecord>(
    source.result.questionResults.map((record) => [
      record.questionIndex,
      record,
    ]),
  );

  let improved = false;
  for (const retry of retryQuestionResults) {
    const originalIndex = originalQuestionIndexes[retry.questionIndex];
    if (typeof originalIndex !== "number") continue;

    const prev = byQuestionIndex.get(originalIndex);
    const prevCorrect = prev?.isCorrect ?? false;
    if (retry.isCorrect && !prevCorrect) {
      byQuestionIndex.set(originalIndex, {
        questionIndex: originalIndex,
        selectedAnswerIndex: retry.selectedAnswerIndex,
        isCorrect: true,
      });
      improved = true;
    }
  }

  if (!improved) return;

  const nextQuestionResults = Array.from(byQuestionIndex.values()).sort(
    (a, b) => a.questionIndex - b.questionIndex,
  );
  const nextCorrectCount = nextQuestionResults.filter(
    (record) => record.isCorrect,
  ).length;

  const next = current.map((item) =>
    item.id === sourceHistoryId
      ? {
          ...item,
          result: {
            ...item.result!,
            correctCount: Math.max(item.result!.correctCount, nextCorrectCount),
            completedAt: Date.now(),
            questionResults: nextQuestionResults,
          },
        }
      : item,
  );

  saveQuizHistory(next);
}

export function clearQuizHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_STORAGE_KEY);
}

export function deleteQuizHistoryByIds(ids: string[]) {
  if (ids.length === 0) return;
  const targetIds = new Set(ids);
  const current = loadQuizHistory();
  const next = current.filter((item) => !targetIds.has(item.id));
  saveQuizHistory(next);
}
