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

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-8 bg-white dark:bg-zinc-900 p-12 rounded-2xl shadow-lg">
        <GameRoom
          roomId={roomId}
          user={{
            id: session.user.id ?? "",
            name: session.user.name ?? "",
          }}
        />
      </main>
    </div>
  );
}
