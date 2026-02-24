// frontend/src/app/actions/quiz.ts

/**
 * Geminiに送るシステムプロンプトの定数
 * AI Studioで調整した内容をここにそのまま貼り付けます。
 */
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
`; // ここで一度閉じる

/**
 * フロントエンドやバックエンドと共有するための「クイズの型」定義
 * (後ほど別のファイルに分けるのが理想ですが、まずはここに書いてもOKです)
 */
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

("use server"); // サーバー側で実行することを宣言

import { GoogleGenerativeAI } from "@google/generative-ai";

// ステップ1で作成した定数と型定義がここにある前提です

export async function generateQuizBatchAction(
  combinedCode: string,
): Promise<QuizBatch | null> {
  // 1. 環境変数からAPIキーを取得
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY が設定されていません。");
    return null;
  }

  // 2. Geminiの初期化
  const genAI = new GoogleGenerativeAI(apiKey);
  // モデルには高速で安価（無料枠が広い）な gemini-2.0-flash を指定します
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  try {
    // 3. プロンプトの組み立て
    // システム命令と、引数で受け取ったソースコードを合体させます
    const finalPrompt = `${SYSTEM_PROMPT}\n\n# 解析対象ソースコード\n${combinedCode}`;

    // 4. Gemini APIを呼び出し（JSON形式で返却するよう設定）
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json", // これにより確実にJSONが返ります
      },
    });

    const responseText = result.response.text();
    if (!responseText) return null;

    // 5. JSONをパースして型を整えて返す
    const quizData = JSON.parse(responseText) as QuizBatch;
    return quizData;
  } catch (error) {
    console.error("クイズ生成中にエラーが発生しました:", error);
    return null;
  }
}
