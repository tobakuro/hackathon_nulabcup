"use server";

import { db } from "../../db/index";
import { repositories, repositoryFiles } from "../../db/schema";
import { eq } from "drizzle-orm";

import { GoogleGenAI } from "@google/genai";

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

function validateRepoParams(
  owner: string,
  repo: string,
  accessToken: string,
  defaultBranch?: string,
) {
  if (!owner) throw new Error("missing owner");
  if (!repo) throw new Error("missing repo");
  if (!accessToken) throw new Error("missing accessToken");
  if (defaultBranch !== undefined && !defaultBranch) throw new Error("missing defaultBranch");

  if (!/^[\w.-]+$/.test(owner)) throw new Error("invalid owner format");
  if (!/^[\w.-]+$/.test(repo)) throw new Error("invalid repo format");
}

/**
 * Server Action: 指定したリポジトリの使用言語とそのバイト数を取得する
 * @param owner リポジトリのオーナー名
 * @param repo リポジトリ名
 * @param accessToken ユーザーのGitHubアクセストークン
 * @returns 言語名とバイト数のオブジェクト (例: { "TypeScript": 1000, "HTML": 500 })
 */
export async function getRepoLanguages(
  owner: string,
  repo: string,
  accessToken: string,
): Promise<Record<string, number>> {
  validateRepoParams(owner, repo, accessToken);

  const res = await fetchWithTimeout(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
      // 言語構成は頻繁に変わるものではないのでキャッシュを効かせつつ、再検証の余地を残すことも可能
      // 今回は最新を取るために no-store にしています
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch languages: ${res.statusText}`);
  }

  const data = await res.json();
  return data;
}

export interface TechDetails {
  name: string;
  purpose: string;
  implementation: string;
}

export interface AIAnalysisReport {
  summary: string;
  architecture: string;
  technologies: TechDetails[];
  analyzedFiles: string[];
}

/**
 * Server Action: 指定したリポジトリの各種ファイルを取得し、Gemini APIで解析して詳細レポートを返す
 * @param owner リポジトリのオーナー名
 * @param repo リポジトリ名
 * @param defaultBranch デフォルトブランチ名 (main, masterなど)
 * @param accessToken ユーザーのGitHubアクセストークン
 */
export async function getRepoDependencies(
  owner: string,
  repo: string,
  defaultBranch: string,
  accessToken: string,
): Promise<AIAnalysisReport | null> {
  validateRepoParams(owner, repo, accessToken, defaultBranch);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined.");
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
  };

  try {
    // 1. Git Trees APIでリポジトリ構造を一括取得
    const treeRes = await fetchWithTimeout(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
      { headers, cache: "no-store" },
    );
    if (!treeRes.ok) {
      throw new Error(`Failed to fetch repository tree: ${treeRes.status} ${treeRes.statusText}`);
    }

    const treeData = await treeRes.json();
    if (!treeData.tree || !Array.isArray(treeData.tree)) {
      throw new Error("Repository tree response is invalid");
    }

    // 2. 「ビジネスロジックの匂いがするファイル」や「設定ファイル」を抽出
    const configNames = [
      "package.json",
      "go.mod",
      "requirements.txt",
      "composer.json",
      "pom.xml",
      "pubspec.yaml",
    ];
    const primaryDirNames = new Set([
      "src",
      "app",
      "lib",
      "components",
      "pages",
      "cmd",
      "internal",
      "handlers",
    ]);
    const codeExts = [".ts", ".tsx", ".js", ".jsx", ".go", ".py", ".php", ".dart", ".cs", ".rb"];
    const ignoreDirs = [
      "node_modules/",
      "vendor/",
      "venv/",
      ".venv/",
      "dist/",
      "build/",
      "out/",
      ".git/",
      "docs/",
      "doc/",
      "examples/",
      "example/",
      "third_party/",
    ];

    const scoredTargets: Array<{ path: string; score: number }> = [];
    for (const item of treeData.tree as Array<{ type: string; path: string }>) {
      if (item.type !== "blob") continue;

      // 無視するディレクトリ配下やテストコード、画像はスキップ
      const lowerPath = item.path.toLowerCase();
      if (ignoreDirs.some((dir) => lowerPath.includes(dir))) continue;
      if (
        /(^|\/)test(\/|$)/.test(lowerPath) ||
        /\.test\./.test(lowerPath) ||
        /\.spec\./.test(lowerPath) ||
        lowerPath.endsWith(".png") ||
        lowerPath.endsWith(".svg") ||
        lowerPath.endsWith(".jpg")
      ) {
        continue;
      }
      if (lowerPath.endsWith(".lock") || lowerPath.endsWith("-lock.json")) continue;

      const name = lowerPath.split("/").pop() || "";
      if (name === "readme.md") continue;
      const segments = lowerPath.split("/");
      const hasPrimaryDir = segments.some((segment) => primaryDirNames.has(segment));
      const isCodeFile = codeExts.some((ext) => lowerPath.endsWith(ext));
      const isRootConfig = configNames.includes(name) && !lowerPath.includes("/");

      if (isCodeFile && hasPrimaryDir) {
        scoredTargets.push({ path: item.path, score: 2 });
        continue;
      }
      if (isRootConfig) {
        scoredTargets.push({ path: item.path, score: 1 });
        continue;
      }
    }

    const targetFiles = scoredTargets
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .map((item: { path: string; score: number }) => ({ path: item.path }))
      .slice(0, 20); // APIとトークン制限を考慮し、最大20ファイルに制限

    if (targetFiles.length === 0) {
      throw new Error("解析対象ファイルが見つかりませんでした");
    }

    // 3. ファイルの中身を並列取得し、1つの巨大なテキストに結合
    const fetchContent = async (path: string) => {
      try {
        const encodedPath = path.split("/").map(encodeURIComponent).join("/");
        const res = await fetchWithTimeout(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`,
          {
            headers,
            cache: "no-store",
          },
        );
        if (!res.ok) return { path, content: "" };
        const data = await res.json();
        if (!data.content) return { path, content: "" };

        const decoded = Buffer.from(data.content, "base64").toString("utf-8");
        return { path, content: decoded };
      } catch {
        return { path, content: "" };
      }
    };

    const contents: PromiseSettledResult<{ path: string; content: string }>[] = [];
    const concurrencyLimit = 5;
    for (let i = 0; i < targetFiles.length; i += concurrencyLimit) {
      const batch = targetFiles.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.allSettled(
        batch.map((file: { path: string }) => fetchContent(file.path)),
      );
      contents.push(...batchResults);
    }
    let combinedText = "";
    const validFilesToSave: Array<{ path: string; content: string }> = [];

    for (const result of contents) {
      if (result.status === "fulfilled" && result.value.content) {
        combinedText += `\n\n=== ${result.value.path} ===\n${result.value.content}`;
        validFilesToSave.push(result.value);
      }
    }

    if (combinedText.trim() === "") {
      throw new Error("解析対象ファイルの内容取得に失敗しました");
    }

    if (combinedText.length > 100000) {
      combinedText = combinedText.substring(0, 100000) + "\n... (truncated)";
    }

    // 4. Gemini APIに渡して構造化出力 (JSON) を生成させる
    const ai = new GoogleGenAI({ apiKey });

    const responseSchema = {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "プロジェクト全体が主に何をするアプリ・システムなのかを簡潔に説明（〜150文字）",
        },
        architecture: {
          type: "string",
          description:
            "全体的な設計手法や工夫点、フロントエンドとバックエンドの繋がりなどの特徴（〜200文字）",
        },
        technologies: {
          type: "array",
          description:
            "使われている主要な技術（最大8個）。eslintなどの単なるビルド/テストツールは省き、プロダクトのコアに直結するライブラリ（MediaPipe、Next.js、Supabaseなど）を抽出すること。",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "技術名 (例: 'React', 'MediaPipe', 'Gin')",
              },
              purpose: {
                type: "string",
                description:
                  "何のために使っているかの一言説明 (例: 'UI構築', '顔認識アルゴリズム')",
              },
              implementation: {
                type: "string",
                description:
                  "どう実装されているかの具体的な概要 (例: 'カメラ映像を解析しランドマークを抽出')",
              },
            },
            required: ["name", "purpose", "implementation"],
          },
        },
      },
      required: ["summary", "architecture", "technologies"],
    };

    const prompt = `以下のソースコードファイル群を解析し、このリポジトリの概要、アーキテクチャ、および使用技術を日本語でJSON形式で出力してください。\n\n${combinedText}`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const reportText = result.text;
    if (!reportText) {
      throw new Error("AI response is empty");
    }
    const report = JSON.parse(reportText) as AIAnalysisReport;
    report.analyzedFiles = targetFiles.map((file: { path: string }) => file.path);

    // 5. 生ソースコードをDBに保存
    try {
      const fullName = `${owner}/${repo}`;
      const [upsertedRepo] = await db
        .insert(repositories)
        .values({
          owner,
          name: repo,
          fullName,
          summaryJson: report,
        })
        .onConflictDoUpdate({
          target: repositories.fullName,
          set: {
            summaryJson: report,
            updatedAt: new Date(),
          },
        })
        .returning({ id: repositories.id });

      const repoId = upsertedRepo.id;

      // 既存のファイルを一度削除して洗い替え、その後インサートをトランザクションで実行
      await db.transaction(async (tx) => {
        await tx.delete(repositoryFiles).where(eq(repositoryFiles.repositoryId, repoId));

        const filesToInsert = validFilesToSave.map((file) => ({
          repositoryId: repoId,
          filePath: file.path,
          content: file.content,
        }));

        if (filesToInsert.length > 0) {
          // 大量ファイル対応のためチャンク分割なども考えられるが20〜30件なので一括で送信
          await tx.insert(repositoryFiles).values(filesToInsert);
        }
      });
    } catch (dbError) {
      console.error("Failed to save raw files to DB:", dbError);
      // DB保存に失敗しても表示用データは返すようにする
    }

    return report;
  } catch (e) {
    console.error("AI Analysis failed:", e);
    throw e instanceof Error ? e : new Error("AI Analysis failed");
  }
}
