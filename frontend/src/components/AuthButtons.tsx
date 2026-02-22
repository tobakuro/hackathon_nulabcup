import { signIn, signOut, auth } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { SubmitButton, SignOutButton } from "./SubmitButtons";

export default async function AuthButtons() {
    const session = await auth();

    if (session) {
        return (
            <div className="flex flex-col items-center gap-4 p-4 border rounded-lg shadow-sm">
                <p>
                    ログイン中: {session.user?.name}
                </p>
                {session.user?.image && (
                    <Image
                        src={session.user.image}
                        alt="user image"
                        width={50}
                        height={50}
                        className="rounded-full"
                    />
                )}
                <Link
                    href="/lobby"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                    ロビーへ
                </Link>
                <form
                    action={async () => {
                        "use server";
                        await signOut();
                    }}
                >
                    <SignOutButton />
                </form>

            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 p-4 border rounded-lg shadow-sm">
            <p>ログインしていません</p>
            <form
                action={async () => {
                    "use server";
                    await signIn("github");
                }}
            >
                <SubmitButton />
            </form>
        </div>
    );
}
