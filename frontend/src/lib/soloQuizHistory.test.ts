import { describe, it, expect, beforeEach } from "vitest";
import {
  loadQuizHistory,
  appendQuizHistory,
  markQuizHistoryResult,
  applyIncorrectRetryResult,
  clearQuizHistory,
  type QuizPayload,
  type QuizHistoryResult,
} from "./soloQuizHistory";

// テスト用フィクスチャ
const mockQuizPayload = (id: string): QuizPayload => ({
  id,
  quizzes: [],
  repoFullName: "owner/repo",
  difficulty: "normal",
  questionCount: 5,
  createdAt: Date.now(),
});

const mockResult = (correctCount: number, totalCount: number): QuizHistoryResult => ({
  correctCount,
  totalCount,
  completedAt: Date.now(),
  questionResults: Array.from({ length: totalCount }, (_, i) => ({
    questionIndex: i,
    selectedAnswerIndex: 0,
    isCorrect: i < correctCount,
  })),
});

describe("soloQuizHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("loadQuizHistory", () => {
    it("空の状態では空配列を返す", () => {
      expect(loadQuizHistory()).toEqual([]);
    });

    it("不正なJSONが保存されていても空配列を返す", () => {
      localStorage.setItem("solo_quiz_history", "invalid json");
      expect(loadQuizHistory()).toEqual([]);
    });

    it("配列でないJSONが保存されていても空配列を返す", () => {
      localStorage.setItem("solo_quiz_history", JSON.stringify({ not: "array" }));
      expect(loadQuizHistory()).toEqual([]);
    });
  });

  describe("appendQuizHistory", () => {
    it("クイズが正しく追加される", () => {
      const payload = mockQuizPayload("quiz-1");
      appendQuizHistory(payload);
      const history = loadQuizHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe("quiz-1");
    });

    it("新しいクイズが先頭に追加される", () => {
      appendQuizHistory(mockQuizPayload("quiz-1"));
      appendQuizHistory(mockQuizPayload("quiz-2"));
      const history = loadQuizHistory();
      expect(history[0].id).toBe("quiz-2");
      expect(history[1].id).toBe("quiz-1");
    });

    it("最大20件を超えたら古いものが削除される", () => {
      for (let i = 1; i <= 21; i++) {
        appendQuizHistory(mockQuizPayload(`quiz-${i}`));
      }
      const history = loadQuizHistory();
      expect(history).toHaveLength(20);
      expect(history[0].id).toBe("quiz-21");
      // quiz-1 は削除されているはず
      expect(history.find((h) => h.id === "quiz-1")).toBeUndefined();
    });
  });

  describe("markQuizHistoryResult", () => {
    it("指定IDのクイズに結果を記録できる", () => {
      appendQuizHistory(mockQuizPayload("quiz-1"));
      const result = mockResult(3, 5);
      markQuizHistoryResult("quiz-1", result);
      const history = loadQuizHistory();
      expect(history[0].result?.correctCount).toBe(3);
      expect(history[0].result?.totalCount).toBe(5);
    });

    it("存在しないIDへの記録は他のアイテムに影響しない", () => {
      appendQuizHistory(mockQuizPayload("quiz-1"));
      markQuizHistoryResult("non-existent", mockResult(5, 5));
      const history = loadQuizHistory();
      expect(history[0].result).toBeUndefined();
    });
  });

  describe("applyIncorrectRetryResult", () => {
    it("リトライで正解になった問題が元の履歴に反映される", () => {
      const payload = mockQuizPayload("quiz-source");
      appendQuizHistory(payload);
      // 最初の結果: 問題0は不正解、問題1は正解
      markQuizHistoryResult("quiz-source", {
        correctCount: 1,
        totalCount: 2,
        completedAt: Date.now(),
        questionResults: [
          { questionIndex: 0, selectedAnswerIndex: 1, isCorrect: false },
          { questionIndex: 1, selectedAnswerIndex: 0, isCorrect: true },
        ],
      });

      // リトライ: 問題0（元の問題0）が正解になった
      applyIncorrectRetryResult(
        "quiz-source",
        [0], // originalQuestionIndexes
        [{ questionIndex: 0, selectedAnswerIndex: 0, isCorrect: true }],
      );

      const history = loadQuizHistory();
      const source = history.find((h) => h.id === "quiz-source");
      expect(source?.result?.correctCount).toBe(2);
      const updatedRecord = source?.result?.questionResults.find((r) => r.questionIndex === 0);
      expect(updatedRecord?.isCorrect).toBe(true);
    });

    it("結果がない履歴には何も影響しない", () => {
      appendQuizHistory(mockQuizPayload("quiz-no-result"));
      applyIncorrectRetryResult(
        "quiz-no-result",
        [0],
        [{ questionIndex: 0, selectedAnswerIndex: 0, isCorrect: true }],
      );
      const history = loadQuizHistory();
      expect(history[0].result).toBeUndefined();
    });

    it("元から正解だった問題は上書きされない", () => {
      const payload = mockQuizPayload("quiz-source");
      appendQuizHistory(payload);
      markQuizHistoryResult("quiz-source", {
        correctCount: 1,
        totalCount: 1,
        completedAt: Date.now(),
        questionResults: [{ questionIndex: 0, selectedAnswerIndex: 0, isCorrect: true }],
      });

      // すでに正解の問題をリトライしても変化しない（improveredフラグが立たない）
      applyIncorrectRetryResult(
        "quiz-source",
        [0],
        [{ questionIndex: 0, selectedAnswerIndex: 0, isCorrect: true }],
      );

      const history = loadQuizHistory();
      const source = history.find((h) => h.id === "quiz-source");
      // 改善がないので保存されない（correctCountは変わらない）
      expect(source?.result?.correctCount).toBe(1);
    });
  });

  describe("clearQuizHistory", () => {
    it("履歴が全件削除される", () => {
      appendQuizHistory(mockQuizPayload("quiz-1"));
      appendQuizHistory(mockQuizPayload("quiz-2"));
      clearQuizHistory();
      expect(loadQuizHistory()).toEqual([]);
    });

    it("空の状態でも問題なく動作する", () => {
      expect(() => clearQuizHistory()).not.toThrow();
    });
  });
});
