"use server";

import { eq } from "drizzle-orm";
import { db } from "../../db";
import { repositoryFiles, codeSessions, codeAnswers } from "../../db/schema";
import { isQuizCandidatePath } from "@/lib/quiz-utils";
import { auth } from "@/auth";

export interface CodeQuizQuestionPublic {
  questionIndex: number;
  targetLineContent: string;
  hint: {
    language: string;
    totalFiles: number;
  };
}

export interface AnswerResult {
  isCorrectFile: boolean;
  lineDifference: number;
  score: number;
  correctFilePath: string;
  correctLineNumber: number;
}

export interface SessionResult {
  totalScore: number;
  maxScore: number;
  questions: Array<{
    questionIndex: number;
    targetLineContent: string;
    correctFilePath: string;
    correctLineNumber: number;
    answeredFilePath: string | null;
    answeredLineNumber: number | null;
    isCorrectFile: boolean | null;
    lineDifference: number | null;
    score: number;
  }>;
}

function isMeaningfulLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === "") return false;
  if (trimmed === "{" || trimmed === "}" || trimmed === ");") return false;
  if (trimmed === "(" || trimmed === ")" || trimmed === "};") return false;
  if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")) return false;
  if (trimmed.startsWith("import ") || trimmed.startsWith("from ")) return false;
  if (trimmed.startsWith("/*") || trimmed.startsWith("*/")) return false;
  if (trimmed.length < 10) return false;
  return true;
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    go: "go",
    py: "python",
    php: "php",
    dart: "dart",
    cs: "csharp",
    rb: "ruby",
  };
  return langMap[ext] ?? "plaintext";
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function calculateScore(
  isCorrectFile: boolean,
  lineDifference: number,
  timeSpentMs: number,
): number {
  if (!isCorrectFile) return 0;

  let score = 100;

  if (lineDifference === 0) {
    score += 200;
  } else if (lineDifference <= 3) {
    score += 150;
  } else if (lineDifference <= 10) {
    score += 100;
  } else if (lineDifference <= 30) {
    score += 50;
  }

  const TIME_LIMIT_MS = 60000;
  if (timeSpentMs < TIME_LIMIT_MS) {
    score += Math.floor(100 * (1 - timeSpentMs / TIME_LIMIT_MS));
  }

  return score;
}

export async function createCodeSessionAction(
  repositoryId: string,
  mode: "solo" | "versus" = "solo",
  roomId?: string,
): Promise<{
  sessionId: string;
  questions: CodeQuizQuestionPublic[];
  fileTree: { filePath: string; content: string }[];
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const files = await db
    .select({
      id: repositoryFiles.id,
      filePath: repositoryFiles.filePath,
      content: repositoryFiles.content,
    })
    .from(repositoryFiles)
    .where(eq(repositoryFiles.repositoryId, repositoryId));

  const candidateFiles = files.filter(
    (f) => isQuizCandidatePath(f.filePath) && f.content.split("\n").length >= 10,
  );

  if (candidateFiles.length < 3) return null;

  const selectedFiles = shuffleArray(candidateFiles).slice(0, 5);

  const questions: Array<{
    questionIndex: number;
    targetFileId: string;
    targetFilePath: string;
    targetLineNumber: number;
    targetLineContent: string;
  }> = [];

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    const lines = file.content.split("\n");
    const meaningfulLines = lines
      .map((line, idx) => ({ line, lineNumber: idx + 1 }))
      .filter((l) => isMeaningfulLine(l.line));

    if (meaningfulLines.length === 0) continue;

    const randomLine = meaningfulLines[Math.floor(Math.random() * meaningfulLines.length)];
    questions.push({
      questionIndex: i,
      targetFileId: file.id,
      targetFilePath: file.filePath,
      targetLineNumber: randomLine.lineNumber,
      targetLineContent: randomLine.line,
    });
  }

  if (questions.length === 0) return null;

  const newSession = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(codeSessions)
      .values({
        userId: session.user.id,
        repositoryId,
        roomId: roomId ?? null,
        mode,
        totalQuestions: questions.length,
      })
      .returning({ id: codeSessions.id });

    await tx.insert(codeAnswers).values(
      questions.map((q) => ({
        sessionId: inserted.id,
        questionIndex: q.questionIndex,
        targetFileId: q.targetFileId,
        targetFilePath: q.targetFilePath,
        targetLineNumber: q.targetLineNumber,
        targetLineContent: q.targetLineContent,
      })),
    );

    return inserted;
  });

  const publicQuestions: CodeQuizQuestionPublic[] = questions.map((q) => ({
    questionIndex: q.questionIndex,
    targetLineContent: q.targetLineContent,
    hint: {
      language: getLanguageFromPath(q.targetFilePath),
      totalFiles: candidateFiles.length,
    },
  }));

  const fileTree = files.map((f) => ({
    filePath: f.filePath,
    content: f.content,
  }));

  return {
    sessionId: newSession.id,
    questions: publicQuestions,
    fileTree,
  };
}

export async function submitCodeAnswerAction(
  sessionId: string,
  questionIndex: number,
  answeredFilePath: string,
  answeredLineNumber: number,
  timeSpentMs: number,
): Promise<AnswerResult | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const clampedLineNumber = Math.max(0, Math.floor(answeredLineNumber));
  const clampedTimeSpentMs = Math.max(0, Math.min(timeSpentMs, 3_600_000));

  const [codeSession] = await db
    .select({ userId: codeSessions.userId })
    .from(codeSessions)
    .where(eq(codeSessions.id, sessionId));

  if (!codeSession || codeSession.userId !== session.user.id) return null;

  const [answer] = await db
    .select()
    .from(codeAnswers)
    .where(eq(codeAnswers.sessionId, sessionId))
    .then((rows) => rows.filter((r) => r.questionIndex === questionIndex));

  if (!answer) return null;

  const isCorrectFile = answer.targetFilePath === answeredFilePath;
  const lineDifference = isCorrectFile ? Math.abs(answer.targetLineNumber - clampedLineNumber) : -1;
  const score = calculateScore(isCorrectFile, lineDifference, clampedTimeSpentMs);

  await db
    .update(codeAnswers)
    .set({
      answeredFilePath,
      answeredLineNumber: clampedLineNumber,
      isCorrectFile,
      lineDifference: isCorrectFile ? lineDifference : null,
      score,
      timeSpentMs: clampedTimeSpentMs,
      answeredAt: new Date(),
    })
    .where(eq(codeAnswers.id, answer.id));

  const allAnswers = await db
    .select()
    .from(codeAnswers)
    .where(eq(codeAnswers.sessionId, sessionId));

  const completedCount = allAnswers.filter((a) => a.answeredAt !== null).length;
  const totalScore = allAnswers.reduce((sum, a) => sum + a.score, 0);

  const [sessionData] = await db.select().from(codeSessions).where(eq(codeSessions.id, sessionId));

  await db
    .update(codeSessions)
    .set({
      completedQuestions: completedCount,
      totalScore,
      ...(completedCount >= sessionData.totalQuestions
        ? { status: "completed", completedAt: new Date() }
        : {}),
    })
    .where(eq(codeSessions.id, sessionId));

  return {
    isCorrectFile,
    lineDifference: isCorrectFile ? lineDifference : -1,
    score,
    correctFilePath: answer.targetFilePath,
    correctLineNumber: answer.targetLineNumber,
  };
}

export async function getCodeSessionResultAction(sessionId: string): Promise<SessionResult | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [codeSession] = await db
    .select({ userId: codeSessions.userId })
    .from(codeSessions)
    .where(eq(codeSessions.id, sessionId));

  if (!codeSession || codeSession.userId !== session.user.id) return null;

  const answers = await db.select().from(codeAnswers).where(eq(codeAnswers.sessionId, sessionId));

  if (answers.length === 0) return null;

  const totalScore = answers.reduce((sum, a) => sum + a.score, 0);

  return {
    totalScore,
    maxScore: answers.length * 400,
    questions: answers
      .sort((a, b) => a.questionIndex - b.questionIndex)
      .map((a) => ({
        questionIndex: a.questionIndex,
        targetLineContent: a.targetLineContent,
        correctFilePath: a.targetFilePath,
        correctLineNumber: a.targetLineNumber,
        answeredFilePath: a.answeredFilePath,
        answeredLineNumber: a.answeredLineNumber,
        isCorrectFile: a.isCorrectFile,
        lineDifference: a.lineDifference,
        score: a.score,
      })),
  };
}
