"use server";

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
    accessToken: string
): Promise<Record<string, number>> {
    if (!owner || !repo || !accessToken) {
        throw new Error("Invalid parameters");
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
        },
        // 言語構成は頻繁に変わるものではないのでキャッシュを効かせつつ、再検証の余地を残すことも可能
        // 今回は最新を取るために no-store にしています
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch languages: ${res.statusText}`);
    }

    const data = await res.json();
    return data;
}

/**
 * Server Action: 指定したリポジトリの各種設定ファイルを取得し、主要な依存関係を抽出する
 * @param owner リポジトリのオーナー名
 * @param repo リポジトリ名
 * @param defaultBranch デフォルトブランチ名 (main, masterなど)
 * @param accessToken ユーザーのGitHubアクセストークン
 * @returns 抽出されたライブラリ/フレームワーク名の配列 (例: ["react", "next", "tailwindcss"])
 */
export async function getRepoDependencies(
    owner: string,
    repo: string,
    defaultBranch: string,
    accessToken: string
): Promise<string[]> {
    if (!owner || !repo || !defaultBranch || !accessToken) {
        throw new Error("Invalid parameters");
    }

    const dependencies: string[] = [];
    const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
    };

    try {
        // 1. Git Trees APIでリポジトリのファイル・ディレクトリ構造を一括取得
        const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers, cache: "no-store" });
        if (!treeRes.ok) return dependencies;

        const treeData = await treeRes.json();
        if (!treeData.tree || !Array.isArray(treeData.tree)) return dependencies;

        // 2. 解析対象のファイル名リスト
        const targetNames = [
            "package.json", "go.mod", "requirements.txt", "pipfile", "pyproject.toml",
            "composer.json", "pom.xml", "build.gradle", "pubspec.yaml", "gemfile"
        ];

        // 解析不要なディレクトリを除外（node_modulesやvenvなど）
        const ignoreDirs = ["node_modules/", "vendor/", "venv/", ".venv/", "env/", ".env/", "dist/", "build/", "out/", "bin/", "obj/", ".git/"];

        const targetFiles = treeData.tree.filter((item: { type: string; path: string }) => {
            if (item.type !== "blob") return false;
            // 無視するディレクトリ配下ならスキップ
            if (ignoreDirs.some(dir => item.path.includes(dir))) return false;

            const name = item.path.split("/").pop()?.toLowerCase() || "";
            return targetNames.includes(name) || name.endsWith(".csproj");
        }).slice(0, 15); // API制限を考慮し、最大15ファイルまでに制限

        // 3. 各ファイルのBase64中身を取得してパースするヘルパー関数
        const fetchAndParse = async (path: string) => {
            try {
                const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers, cache: "no-store" });
                if (!res.ok) return;

                const data = await res.json();
                if (!data.content) return;

                const decodedText = Buffer.from(data.content, "base64").toString("utf-8");
                const name = path.split("/").pop()?.toLowerCase() || "";

                // 重複なく配列に追加する関数
                const addDeps = (found: string[]) => {
                    for (const f of found) {
                        if (f && !dependencies.includes(f)) dependencies.push(f);
                    }
                };

                if (name === "package.json") {
                    try {
                        const pkg = JSON.parse(decodedText);
                        const allDeps = Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.devDependencies || {}));
                        const libs = ["react", "next", "vue", "nuxt", "svelte", "@angular/core", "tailwindcss", "prisma", "drizzle-orm", "express", "fastify", "@nestjs/core", "astro"];
                        const found = allDeps.filter(d => libs.includes(d) || d.startsWith("@vitejs/") || d.startsWith("eslint"));
                        addDeps(found.map(f => f === "@nestjs/core" ? "nestjs" : f));
                    } catch { /* ignore parse error */ }
                }
                else if (name === "go.mod") {
                    const goLibs = [
                        { path: "gin-gonic/gin", name: "gin" }, { path: "labstack/echo", name: "echo" },
                        { path: "gofiber/fiber", name: "fiber" }, { path: "gorm.io/gorm", name: "gorm" },
                        { path: "jmoiron/sqlx", name: "sqlx" }, { path: "gorilla/websocket", name: "websocket" },
                        { path: "joho/godotenv", name: "godotenv" }, { path: "lib/pq", name: "postgres" },
                        { path: "redis/go-redis", name: "redis" }
                    ];
                    addDeps(goLibs.filter(lib => decodedText.includes(lib.path)).map(l => l.name));
                }
                else if (name === "requirements.txt" || name === "pipfile" || name === "pyproject.toml") {
                    const pyLibs = ["django", "flask", "fastapi", "requests", "numpy", "pandas", "tensorflow", "torch", "scikit-learn", "sqlalchemy", "celery", "pytest"];
                    const lowerText = decodedText.toLowerCase();
                    addDeps(pyLibs.filter(lib => lowerText.includes(lib)));
                }
                else if (name === "composer.json") {
                    try {
                        const pkg = JSON.parse(decodedText);
                        const allDeps = Object.keys(pkg.require || {}).concat(Object.keys(pkg["require-dev"] || {}));
                        const phpLibs = {
                            "laravel/framework": "laravel", "symfony/symfony": "symfony",
                            "guzzlehttp/guzzle": "guzzle", "phpunit/phpunit": "phpunit",
                            "cakephp/cakephp": "cakephp", "codeigniter4/framework": "codeigniter"
                        };
                        const found = allDeps.filter(d => Object.keys(phpLibs).includes(d)).map(d => phpLibs[d as keyof typeof phpLibs]);
                        addDeps(found.map(String));
                    } catch { /* ignore parse error */ }
                }
                else if (name === "pom.xml" || name === "build.gradle") {
                    const javaLibs = ["spring-boot", "hibernate", "junit", "lombok", "mockito", "quartz"];
                    const lowerText = decodedText.toLowerCase();
                    addDeps(javaLibs.filter(lib => lowerText.includes(lib)));
                }
                else if (name === "pubspec.yaml") {
                    const dartLibs = ["flutter", "provider", "riverpod", "get", "bloc", "http", "dio"];
                    const lowerText = decodedText.toLowerCase();
                    addDeps(dartLibs.filter(lib => lowerText.includes(lib + ":")));
                }
                else if (name.endsWith(".csproj")) {
                    const csLibs = [
                        { scan: "Microsoft.AspNetCore", name: "asp.net-core" },
                        { scan: "EntityFrameworkCore", name: "entity-framework" },
                        { scan: "Newtonsoft.Json", name: "newtonsoft-json" },
                        { scan: "Serilog", name: "serilog" },
                        { scan: "MediatR", name: "mediatr" },
                        { scan: "xunit", name: "xunit" },
                        { scan: "NUnit", name: "nunit" }
                    ];
                    addDeps(csLibs.filter(lib => decodedText.includes(lib.scan)).map(l => l.name));
                }
                else if (name === "gemfile") {
                    const rubyLibs = ["rails", "sinatra", "rspec", "devise", "sidekiq", "puma"];
                    const lowerText = decodedText.toLowerCase();
                    addDeps(rubyLibs.filter(lib => lowerText.includes(`gem '${lib}'`) || lowerText.includes(`gem "${lib}"`)));
                }

            } catch (e) {
                console.error(`Failed to fetch/parse ${path}:`, e);
            }
        };

        // 並列で最大15ファイルをリクエストして中身をパース
        await Promise.allSettled(targetFiles.map((file: { path: string }) => fetchAndParse(file.path)));

    } catch (e) {
        console.error("Failed to fetch tree:", e);
    }

    return dependencies;
}
