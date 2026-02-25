import { auth } from "@/auth";
import { redirect } from "next/navigation";
import GameRoom from "./GameRoom";

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth");
  }

  const { roomId } = await params;
  const user = session.user as typeof session.user & { github_login?: string; github_id?: number };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black overflow-hidden relative">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-linear-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-linear-to-tr from-emerald-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      <main className="relative z-10 w-full max-w-2xl px-4">
        <GameRoom
          roomId={roomId}
          user={{
            id: user.id ?? "",
            name: user.name ?? "",
            github_login: user.github_login ?? "",
            github_id: user.github_id ?? 0,
          }}
        />
      </main>
    </div>
  );
}
