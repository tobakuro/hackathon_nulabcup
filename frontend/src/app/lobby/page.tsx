import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import MatchmakingPanel from "./MatchmakingPanel";

export default async function LobbyPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black overflow-hidden relative">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-linear-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-linear-to-tr from-emerald-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      <main className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            🎮 ロビー
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            対戦相手を見つけてクイズバトル開始
          </p>
        </div>

        {/* User Card */}
        <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {/* User Info Bar */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ""}
                width={36}
                height={36}
                className="rounded-full ring-2 ring-blue-500/20"
              />
            )}
            <div>
              <p className="font-medium text-zinc-900 dark:text-white text-sm">
                {session.user.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">ログイン中</p>
            </div>
          </div>

          {/* Matchmaking Panel */}
          <div className="p-6">
            <MatchmakingPanel
              user={{
                id: session.user.id ?? "",
                name: session.user.name ?? "",
                image: session.user.image ?? "",
                github_login:
                  ((session.user as unknown as Record<string, unknown>).github_login as string) ||
                  "",
                github_id:
                  ((session.user as unknown as Record<string, unknown>).github_id as number) || 0,
              }}
            />
          </div>
        </div>

        {/* Back Link */}
        <Link
          href="/"
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          ← トップページに戻る
        </Link>
      </main>
    </div>
  );
}
