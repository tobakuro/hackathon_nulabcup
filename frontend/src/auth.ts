import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

if (!process.env.GITHUB_ID || !process.env.GITHUB_SECRET) {
    throw new Error('Missing GITHUB_ID or GITHUB_SECRET');
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        GitHub({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
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
        jwt({ token, user, profile }) {
            if (user) {
                token.github_id = (user as Record<string, unknown>).github_id;
                token.github_login = (user as Record<string, unknown>).github_login;
            }
            // profile から直接取得（初回ログイン時）
            if (profile) {
                token.github_login = token.github_login ?? (profile as Record<string, unknown>).login;
                token.github_id = token.github_id ?? (profile as Record<string, unknown>).id;
            }
            return token;
        },
        session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub ?? "";
                (session.user as Record<string, unknown>).github_id = token.github_id;
                (session.user as Record<string, unknown>).github_login = token.github_login;
            }
            return session;
        },
    },
});
