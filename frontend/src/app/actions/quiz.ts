"use server";

import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `
指示
あなたは優秀なフルスタックエンジニア兼プログラミング講師です。
提供されたリポジトリのソースコードを深く分析し、ユーザーが自分のプロダクトの「実装の詳細」と「設計意図」を覚えているかを確認するための技術クイズを合計10問生成してください。
構成案
Lv1（初級）: 3問（ディレクトリ構造、package.jsonの依存関係、主要技術スタック）
Lv2（中級）: 4問（関数の引数/戻り値、コンポーネント間のProps、処理の実行順序）
Lv3（上級）: 3問（認証フローの詳細、エッジケース対策、セキュリティ、特定の技術選定の理由）
厳守事項（ハルシネーション対策）
コードへの忠実性: 提供されたコード内に実在する「具体的な変数名」「関数名」「ファイルパス」を必ず問題に含めてください。
一般的知識の排除: 「ReactのuseStateとは？」のような一般的な質問は禁止です。「このリポジトリの○○コンポーネントでuseStateを使って管理している状態は何ですか？」のように、コードを見なければ解けない問題にしてください。
偽情報の禁止: 実在しないライブラリ名や関数名を「正解」として扱うことは厳禁です。
クイズ形式
4択問題（正解は常に1つ）。
Tips（解説）はMarkdown形式で記述してください。
Tipsには、該当するコードの断片を引用し、「なぜそれが正解なのか」を論理的に説明してください。
Tipsには可能であれば、選択肢の技術が一般的にどのように使われているかなどを説明してください。
出力形式 (JSON)
必ず以下のスキーマに従った1つのJSONオブジェクトとして出力してください。
{
"quizzes": [
{
"difficulty": "Lv1",
"question": "問題文をここに記述",
"options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
"answerIndex": 0,
"tips": "### 解説\nここにMarkdownで記述",
"relatedFile": "src/components/Example.tsx"
}
]
}
解析対象ソースコード
以下のコードを分析してクイズを作成してください：
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

// 内部用：ファイル取得関数
async function fetchAndCombineCode(
  owner: string,
  repo: string,
  accessToken: string,
  targetFiles: string[],
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
  };

  let combinedText = "";

  for (const path of targetFiles) {
    try {
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`,
        { headers, cache: "no-store" },
      );

      if (!res.ok) continue;
      const data = await res.json();
      if (!data.content) continue;

      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      combinedText += `\n\n=== FILE: ${path} ===\n${decoded}`;
    } catch (error) {
      console.error(`ファイル取得失敗: ${path}`, error);
    }
  }
  return combinedText;
}

// 公開用：クイズ生成Action
export async function generateQuizBatchAction(
  owner: string,
  repo: string,
  accessToken: string,
  targetFiles: string[],
): Promise<QuizBatch | null> {
  const combinedCode = await fetchAndCombineCode(owner, repo, accessToken, targetFiles);
  if (!combinedCode) return null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });

  try {
    const finalPrompt = `${SYSTEM_PROMPT}\n\n# 解析対象ソースコード\n${combinedCode}`;
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: finalPrompt,
      config: { responseMimeType: "application/json" },
    });
    const responseText = result.text;
    if (!responseText) return null;
    return JSON.parse(responseText) as QuizBatch;
  } catch (error) {
    console.error("Gemini呼び出しエラー:", error);
    return null;
  }
}
