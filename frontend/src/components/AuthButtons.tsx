import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";
import { SubmitButton } from "./SubmitButtons";

export default async function AuthButtons() {
  const session = await auth();

  // ログイン済みなら /home にリダイレクト
  if (session) {
    redirect("/home");
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="text-center">
        <p className="text-zinc-600 dark:text-zinc-400">GitHubアカウントで始めましょう</p>
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
