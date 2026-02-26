"use server";

import { GoogleGenAI } from "@google/genai";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { repositories, repositoryFiles } from "../../db/schema";

const PRODUCT_MODE_SYSTEM_PROMPT = `
指示
あなたは優秀なフルスタックエンジニア兼プログラミング講師です。
提供されたリポジトリのソースコードを深く分析し、ユーザーが自分のプロダクトの「実装の詳細」と「設計意図」を覚えているかを確認するための技術クイズを生成してください。
このモードでは、実際にこのプロダクトの開発に携わった人でないと回答が難しい問題を出題してください。
構成案
Lv1（初級）: このリポジトリで実際に使われているファイル名・ディレクトリ名・依存パッケージ名など、コードを読んだことがあれば思い出せるレベルの問題
  例: 「このプロジェクトのエントリポイントはどのファイルですか？」「認証に使われているライブラリは？」
Lv2（中級）: 特定のコンポーネントや関数が何をしているか、どんな引数やPropsを受け取るかなど、実装の中身に踏み込んだ問題
  例: 「○○コンポーネントでuseStateで管理している状態は何ですか？」「○○関数の戻り値は何ですか？」
Lv3（上級）: 設計意図・なぜその技術を選んだのか・エラーハンドリングやエッジケースの処理方法など、深い理解が必要な問題
  例: 「○○の処理でエラーが発生した場合、どのような挙動になりますか？」「○○で△△ライブラリを使っている理由として最も適切なのは？」
厳守事項（ハルシネーション対策）
一般的知識の排除: 「ReactのuseStateとは？」のような一般的な質問は禁止です。「このリポジトリの○○コンポーネントでuseStateを使って管理している状態は何ですか？」のように、コードを見なければ解けない問題にしてください。
偽情報の禁止: 実在しないライブラリ名や関数名を「正解」として扱うことは厳禁です。
難易度の調整: 問題が難しすぎないよう注意してください。選択肢は紛らわしすぎず、コードを読んだことがある人なら正解できるレベルにしてください。不正解の選択肢も現実的なものにしてください。
クイズ形式
4択問題（正解は常に1つ）。
Tips（解説）はMarkdown形式で記述してください。
Tipsには、該当するコードの断片を引用し、「なぜそれが正解なのか」を論理的に説明してください。
Tipsには可能であれば、選択肢の技術が一般的にどのように使われているか例を示してください。
README.md や docs だけに依存した問題は作らず、必ず実装コード（.ts/.tsx/.js/.jsx/.go など）から出題してください。
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

const TECH_MODE_SYSTEM_PROMPT = `
指示
あなたは優秀なフルスタックエンジニア兼プログラミング講師です。
提供されたリポジトリのソースコードを分析し、そのリポジトリで実際に使われている技術・ライブラリ・フレームワークの範囲内で、一般的な技術知識があれば解ける問題を生成してください。
このモードでは、このプロダクトの開発者でなくても、使われている技術の基本的な知識があれば正解できる問題を出題してください。
構成案
Lv1（初級）: リポジトリで使われている技術やライブラリの基本的な概念・用語に関する問題
  例: 「ReactのuseStateフックの役割として正しいのはどれですか？」「Next.jsのファイルベースルーティングとは？」「TypeScriptのinterface と type の違いは？」
Lv2（中級）: リポジトリで使われている技術の使い方・ベストプラクティスに関する問題
  例: 「React.memoを使う目的として正しいのは？」「Next.jsのServer Actionsの特徴は？」「DrizzleORMでリレーションを定義する方法は？」
Lv3（上級）: リポジトリで使われている技術の仕組み・内部動作・応用的な知識に関する問題
  例: 「ReactのReconciliationアルゴリズムの仕組みは？」「Next.jsのISRとSSGの違いは？」「OAuth2.0の認可コードフローの手順は？」
厳守事項
リポジトリとの関連性: 問題は必ずリポジトリで実際に使われている技術に限定してください。リポジトリで使われていない技術についての問題は出さないでください。
プロダクト固有の知識は不要: 問題を解くためにこのリポジトリのコードの具体的な実装を知っている必要はないようにしてください。あくまで使われている技術の一般的な知識で解ける問題にしてください。
偽情報の禁止: 実在しないライブラリ名や関数名を「正解」として扱うことは厳禁です。
難易度の調整: 問題が難しすぎないよう注意してください。各レベルの難易度設定を守り、Lv1は初学者でも解けるレベル、Lv3でも実務経験があれば解けるレベルにしてください。
クイズ形式
4択問題（正解は常に1つ）。
Tips（解説）はMarkdown形式で記述してください。
Tipsには、なぜそれが正解なのかを分かりやすく説明してください。
Tipsには、その技術がこのリポジトリのどのファイルで使われているか具体的に示してください。
Tipsには可能であれば、その技術の一般的な使い方の例やベストプラクティスも示してください。
README.md や docs だけに依存した問題は作らず、必ず実装コード（.ts/.tsx/.js/.jsx/.go など）で使われている技術から出題してください。
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

export interface QuizQuestion {
  difficulty: "Lv1" | "Lv2" | "Lv3";
  question: string;
  options: [string, string, string, string];
  answerIndex: number;
  tips: string;
  relatedFile: string;
}

export interface QuizBatch {
  quizzes: QuizQuestion[];
}

import { isQuizCandidatePath } from "@/lib/quiz-utils";

export type SoloDifficulty = "easy" | "normal" | "hard";
export type SoloMode = "product" | "tech";

export interface QuizGenerationOptions {
  difficulty?: SoloDifficulty;
  questionCount?: number;
  mode?: SoloMode;
}

const SOLO_DIFFICULTY_TO_LEVEL: Record<SoloDifficulty, QuizQuestion["difficulty"]> = {
  easy: "Lv1",
  normal: "Lv2",
  hard: "Lv3",
};

function normalizeQuestionCount(count: number | undefined): number {
  if (typeof count !== "number" || !Number.isFinite(count)) return 10;
  const normalized = Math.floor(count);
  return Math.min(Math.max(normalized, 1), 30);
}

function buildConstraintPrompt(options: QuizGenerationOptions | undefined): string {
  const questionCount = normalizeQuestionCount(options?.questionCount);
  const requestedLevel = options?.difficulty
    ? SOLO_DIFFICULTY_TO_LEVEL[options.difficulty]
    : undefined;

  if (!requestedLevel) {
    return `# 追加制約\n必ず${questionCount}問を生成してください。`;
  }

  return `# 追加制約
- 出題する難易度は ${requestedLevel} のみ（他難易度は生成しない）
- 問題数は必ず ${questionCount} 問`;
}

function applyQuizConstraints(
  quizBatch: QuizBatch,
  options: QuizGenerationOptions | undefined,
): QuizBatch {
  const requestedLevel = options?.difficulty
    ? SOLO_DIFFICULTY_TO_LEVEL[options.difficulty]
    : undefined;
  const questionCount = normalizeQuestionCount(options?.questionCount);

  let quizzes = quizBatch.quizzes;
  if (requestedLevel) {
    quizzes = quizzes.filter((quiz) => quiz.difficulty === requestedLevel);
  }

  return { quizzes: quizzes.slice(0, questionCount) };
}

async function fetchAndCombineCodeFromDb(
  owner: string,
  repo: string,
  targetFiles: string[],
): Promise<string> {
  const candidateTargetFiles = targetFiles.filter(isQuizCandidatePath);
  const filesToRead = candidateTargetFiles.length > 0 ? candidateTargetFiles : targetFiles;

  const fullName = `${owner}/${repo}`;
  const [repository] = await db
    .select({ id: repositories.id })
    .from(repositories)
    .where(eq(repositories.fullName, fullName))
    .limit(1);

  if (!repository) return "";

  const rows =
    filesToRead.length > 0
      ? await db
          .select({
            filePath: repositoryFiles.filePath,
            content: repositoryFiles.content,
          })
          .from(repositoryFiles)
          .where(
            and(
              eq(repositoryFiles.repositoryId, repository.id),
              inArray(repositoryFiles.filePath, filesToRead),
            ),
          )
      : await db
          .select({
            filePath: repositoryFiles.filePath,
            content: repositoryFiles.content,
          })
          .from(repositoryFiles)
          .where(eq(repositoryFiles.repositoryId, repository.id));

  let combinedText = "";

  if (filesToRead.length > 0) {
    const contentByPath = new Map(rows.map((row) => [row.filePath, row.content]));
    for (const path of filesToRead) {
      const content = contentByPath.get(path);
      if (!content) continue;
      combinedText += `\n\n=== FILE: ${path} ===\n${content}`;
    }
  } else {
    for (const row of rows) {
      combinedText += `\n\n=== FILE: ${row.filePath} ===\n${row.content}`;
    }
  }

  return combinedText;
}

export async function generateQuizBatchAction(
  owner: string,
  repo: string,
  accessToken: string,
  targetFiles: string[],
  options?: QuizGenerationOptions,
): Promise<QuizBatch | null> {
  void accessToken;
  const combinedCode = await fetchAndCombineCodeFromDb(owner, repo, targetFiles);
  if (!combinedCode) return null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });

  try {
    const constraintPrompt = buildConstraintPrompt(options);
    const systemPrompt =
      options?.mode === "tech" ? TECH_MODE_SYSTEM_PROMPT : PRODUCT_MODE_SYSTEM_PROMPT;
    const finalPrompt = `${systemPrompt}\n\n${constraintPrompt}\n\n# 解析対象ソースコード\n${combinedCode}`;
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: finalPrompt,
      config: { responseMimeType: "application/json" },
    });
    const responseText = result.text;
    if (!responseText) return null;
    const parsed = JSON.parse(responseText) as QuizBatch;
    if (!parsed || !Array.isArray(parsed.quizzes)) return null;
    return applyQuizConstraints(parsed, options);
  } catch (error) {
    console.error("Gemini呼び出しエラー:", error);
    return null;
  }
}
