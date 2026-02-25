import AuthButtons from "@/components/AuthButtons";
import { Suspense } from "react";

export default function AuthPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
            <main className="flex flex-col items-center gap-8 bg-white dark:bg-zinc-900 p-12 rounded-2xl shadow-lg">
                <Suspense
                    fallback={
                        <div className="flex flex-col items-center gap-4 p-4 border rounded-lg shadow-sm w-full min-w-[200px] justify-center">
                            <div className="w-8 h-8 border-4 border-zinc-200 border-t-black dark:border-zinc-700 dark:border-t-white rounded-full animate-spin"></div>
                            <p className="text-sm text-zinc-500">読み込み中...</p>
                        </div>
                    }
                >
                    <AuthButtons />
                </Suspense>
            </main>
        </div>
    );
}
