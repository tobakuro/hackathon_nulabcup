import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SoloQuizHistoryPanel from "@/components/SoloQuizHistoryPanel";
import BackToPreviousButton from "./BackToPreviousButton";

export default async function SoloHistoryPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-linear-to-br from-emerald-400/20 to-teal-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-linear-to-tr from-blue-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      <main className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-6">
        <div className="w-full flex items-center justify-between">
          <BackToPreviousButton />
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">履歴</h1>
          <div className="w-20" />
        </div>

        <SoloQuizHistoryPanel />
      </main>
    </div>
  );
}
