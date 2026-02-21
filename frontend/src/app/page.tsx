import AuthButtons from "@/components/AuthButtons";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-8 bg-white dark:bg-zinc-900 p-12 rounded-2xl shadow-lg">
        <AuthButtons />
      </main>
    </div>
  );
}
