import { signIn, signOut, auth } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { SubmitButton, SignOutButton } from "./SubmitButtons";

export default async function AuthButtons() {
  const session = await auth();

  if (session) {
    return (
      <div className="flex flex-col items-center gap-6 w-full">
        {/* User Info */}
        <div className="flex flex-col items-center gap-3">
          {session.user?.image && (
            <div className="relative">
              <Image
                src={session.user.image}
                alt="user image"
                width={64}
                height={64}
                className="rounded-full ring-2 ring-blue-500/30 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-zinc-900" />
            </div>
          )}
          <div className="text-center">
            <p className="font-semibold text-zinc-900 dark:text-white text-lg">
              {session.user?.name}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">ログイン中</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 w-full">
          <Link
            href="/lobby"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all duration-200"
          >
            🎮 ロビーへ
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
            className="w-full"
          >
            <SignOutButton />
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="text-center">
        <p className="text-zinc-600 dark:text-zinc-400">
          GitHubアカウントで始めましょう
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await signIn("github");
        }}
        className="w-full"
      >
        <SubmitButton />
      </form>
    </div>
  );
}
