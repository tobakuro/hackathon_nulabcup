"use server";

import { GoogleGenAI } from "@google/genai";
import { eq, desc } from "drizzle-orm";
import { db } from "../../db";
import { repositories, repositoryFiles, battleQuizzes, users } from "../../db/schema";
import { auth } from "@/auth";
import { type QuizQuestion, type QuizBatch } from "./quiz";

const BATTLE_SYSTEM_PROMPT = `
指示
あなたは優秀なフルスタックエンジニア兼プログラミング講師です。
提供されたリポジトリのソースコードを深く分析し、そのコードを書いた本人または技術的な知識がある人が解けるクイズを生成してください。
プロダクト固有の問題（実装の詳細）と技術一般の問題（使われている技術の知識）を混ぜて出題してください。
厳守事項（ハルシネーション対策）
偽情報の禁止: 実在しないライブラリ名や関数名を「正解」として扱うことは厳禁です。
難易度: Lv1（Easy）・Lv2（Normal）・Lv3（Hard）を均等に出題してください。
クイズ形式
4択問題（正解は常に1つ）。
Tips（解説）はMarkdown形式で記述してください。
出力形式 (JSON)
必ず以下のスキーマに従った1つのJSONオブジェクトとして出力してください。
{
"quizzes": [
{
"difficulty": "Lv1",
"question": "問題文をここに記述",
"options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
"answerIndex": 0,
"tips": "### 解説\\nここにMarkdownで記述",
"relatedFile": "src/components/Example.tsx"
}
]
}
`;

async function fetchCodeFromRepo(
  repoFullName: string,
): Promise<{ code: string; repositoryId: string | null }> {
  const [repository] = await db
    .select({ id: repositories.id })
    .from(repositories)
    .where(eq(repositories.fullName, repoFullName))
    .limit(1);

  if (!repository) return { code: "", repositoryId: null };

  const rows = await db
    .select({ filePath: repositoryFiles.filePath, content: repositoryFiles.content })
    .from(repositoryFiles)
    .where(eq(repositoryFiles.repositoryId, repository.id));

  let combinedText = "";
  for (const row of rows) {
    combinedText += `\n\n=== FILE: ${row.filePath} ===\n${row.content}`;
  }

  if (combinedText.length > 80000) {
    combinedText = combinedText.substring(0, 80000) + "\n... (truncated)";
  }

  return { code: combinedText, repositoryId: repository.id };
}

async function generateQuizzesFromCode(
  code: string,
  count: number,
): Promise<QuizQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !code) return [];

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `${BATTLE_SYSTEM_PROMPT}\n\n# 追加制約\n- 出題数は必ず ${count} 問\n- 難易度はLv1・Lv2・Lv3をできる限り均等に\n\n# 解析対象ソースコード\n${code}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    const text = result.text;
    if (!text) return [];
    const parsed = JSON.parse(text) as QuizBatch;
    if (!Array.isArray(parsed?.quizzes)) return [];
    return parsed.quizzes.slice(0, count);
  } catch (e) {
    console.error("Gemini battle quiz generation error:", e);
    return [];
  }
}

export interface BattleQuestion {
  difficulty: string;
  question_text: string;
  correct_answer: string;
  tips: string;
  choices: string[];
}

export interface BattleQuizResult {
  // 相手のリポジトリから生成 → 自分が解く問題（5問）
  myQuestions: BattleQuestion[];
  // 自分のリポジトリから生成 → 相手が解く問題（5問）
  forOpponent: BattleQuestion[];
}

const DIFF_MAP: Record<string, string> = { Lv1: "easy", Lv2: "normal", Lv3: "hard" };

function toBackendQuestion(q: QuizQuestion): BattleQuestion {
  return {
    difficulty: DIFF_MAP[q.difficulty] ?? "normal",
    question_text: q.question,
    correct_answer: q.options[q.answerIndex],
    tips: q.tips,
    choices: [...q.options],
  };
}

/**
 * 指定したgithub_loginの最新解析済みリポジトリのfull_nameを返す
 */
export async function getLatestRepoFullName(githubLogin: string): Promise<string | null> {
  const [repo] = await db
    .select({ fullName: repositories.fullName })
    .from(repositories)
    .where(eq(repositories.owner, githubLogin))
    .orderBy(desc(repositories.updatedAt))
    .limit(1);
  return repo?.fullName ?? null;
}

/**
 * 対戦用問題を生成してDBに保存する
 * - 自分のリポジトリ（最新の解析済み）から5問 → forOpponent（相手が解く）
 * - 相手のリポジトリ（github_login指定、最新）から5問 → myQuestions（自分が解く）
 * - 生成した10問をbattle_quizzesテーブルに保存
 */
export async function generateBattleQuizAction(
  roomId: string,
  opponentGithubLogin: string,
): Promise<BattleQuizResult | null> {
  const session = await auth();
  const githubLogin = (session?.user as unknown as Record<string, unknown>)?.github_login as string | undefined;
  if (!githubLogin) throw new Error("未認証です");

  // 自分と相手の最新解析済みリポジトリを並列で取得
  const [myRepoRow, oppRepoFullName] = await Promise.all([
    db
      .select({ id: repositories.id, fullName: repositories.fullName })
      .from(repositories)
      .where(eq(repositories.owner, githubLogin))
      .orderBy(desc(repositories.updatedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getLatestRepoFullName(opponentGithubLogin),
  ]);

  // 並列でコード取得 & 問題生成
  const [myCodeResult, oppCodeResult] = await Promise.all([
    myRepoRow
      ? fetchCodeFromRepo(myRepoRow.fullName)
      : Promise.resolve({ code: "", repositoryId: null }),
    oppRepoFullName
      ? fetchCodeFromRepo(oppRepoFullName)
      : Promise.resolve({ code: "", repositoryId: null }),
  ]);

  const [forOpponentQuizzes, myQuizzes] = await Promise.all([
    myCodeResult.code
      ? generateQuizzesFromCode(myCodeResult.code, 5)
      : Promise.resolve([] as QuizQuestion[]),
    oppCodeResult.code
      ? generateQuizzesFromCode(oppCodeResult.code, 5)
      : Promise.resolve([] as QuizQuestion[]),
  ]);

  if (forOpponentQuizzes.length === 0 && myQuizzes.length === 0) return null;

  // DBにユーザーIDで保存
  const githubId = (session?.user as unknown as Record<string, unknown>)?.github_id as number | undefined;
  if (githubId) {
    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.githubId, githubId))
      .limit(1);

    if (dbUser) {
      const quizzesToInsert = [
        ...forOpponentQuizzes.map((q, i) => ({
          roomId,
          generatedByUserId: dbUser.id,
          source: "my_repo" as const,
          repositoryId: myCodeResult.repositoryId ?? undefined,
          turnIndex: i + 1,
          difficulty: DIFF_MAP[q.difficulty] ?? "normal",
          questionText: q.question,
          choices: [...q.options] as string[],
          correctAnswer: q.options[q.answerIndex],
          tips: q.tips,
        })),
        ...myQuizzes.map((q, i) => ({
          roomId,
          generatedByUserId: dbUser.id,
          source: "opponent_repo" as const,
          repositoryId: oppCodeResult.repositoryId ?? undefined,
          turnIndex: i + 1,
          difficulty: DIFF_MAP[q.difficulty] ?? "normal",
          questionText: q.question,
          choices: [...q.options] as string[],
          correctAnswer: q.options[q.answerIndex],
          tips: q.tips,
        })),
      ];

      try {
        await db.insert(battleQuizzes).values(quizzesToInsert);
      } catch (e) {
        console.error("Failed to save battle quizzes:", e);
      }
    }
  }

  return {
    myQuestions: myQuizzes.map(toBackendQuestion),
    forOpponent: forOpponentQuizzes.map(toBackendQuestion),
  };
}
