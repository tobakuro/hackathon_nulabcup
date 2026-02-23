import { auth } from "@/auth";
import { redirect } from "next/navigation";
import MatchmakingPanel from "./MatchmakingPanel";

export default async function LobbyPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-8 bg-white dark:bg-zinc-900 p-12 rounded-2xl shadow-lg">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">ロビー</h1>
        <MatchmakingPanel
          user={{
            id: session.user.id ?? "",
            name: session.user.name ?? "",
            image: session.user.image ?? "",
            github_login: ((session.user as unknown as Record<string, unknown>).github_login as string) || "",
            github_id: ((session.user as unknown as Record<string, unknown>).github_id as number) || 0,
          }}
        />
      </main>
    </div>
  );
}
