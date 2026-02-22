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
