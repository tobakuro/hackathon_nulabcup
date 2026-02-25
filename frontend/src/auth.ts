import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db } from "./db";
import { users } from "./db/schema";

// ビルド時にはダミー値を使用、実行時には実際の値が必要
const GITHUB_ID = process.env.GITHUB_ID || "dummy-id";
const GITHUB_SECRET = process.env.GITHUB_SECRET || "dummy-secret";

// 環境変数が設定されていない場合は警告を出力
if (!process.env.GITHUB_ID || !process.env.GITHUB_SECRET) {
  console.warn("⚠️  GITHUB_ID or GITHUB_SECRET is not set. Using dummy values for build.");
  console.warn("⚠️  GitHub authentication will not work without proper environment variables.");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: GITHUB_ID,
      clientSecret: GITHUB_SECRET,
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          github_id: profile.id,
          github_login: profile.login,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // 初回ログイン時にusersテーブルにユーザー情報を作成（既存なら更新）
      if (profile) {
        try {
          const githubId = (profile as Record<string, unknown>).id as number;
          const githubLogin = (profile as Record<string, unknown>).login as string;

          await db
            .insert(users)
            .values({
              githubId,
              githubLogin,
            })
            .onConflictDoUpdate({
              target: users.githubId,
              set: {
                githubLogin,
                updatedAt: new Date(),
              },
            });
        } catch (error) {
          console.warn("Failed to upsert user to DB:", error);
          // DB接続エラーでもログイン自体は許可する
        }
      }
      return true;
    },
    jwt({ token, user, profile, account }) {
      if (user) {
        token.github_id = (user as Record<string, unknown>).github_id;
        token.github_login = (user as Record<string, unknown>).github_login;
      }
      if (profile) {
        token.github_login = token.github_login ?? (profile as Record<string, unknown>).login;
        token.github_id = token.github_id ?? (profile as Record<string, unknown>).id;
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        (session.user as unknown as Record<string, unknown>).github_id = token.github_id;
        (session.user as unknown as Record<string, unknown>).github_login = token.github_login;
      }
      if (token.accessToken) {
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
});
