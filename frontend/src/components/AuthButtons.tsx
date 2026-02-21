import { signIn, signOut, auth } from "@/auth";
import Image from "next/image";

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
                <form
                    action={async () => {
                        "use server";
                        await signOut();
                    }}
                >
                    <button
                        type="submit"
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                    >
                        ログアウト
                    </button>
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
                <button
                    type="submit"
                    className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition"
                >
                    GitHubでログイン
                </button>
            </form>
        </div>
    );
}
