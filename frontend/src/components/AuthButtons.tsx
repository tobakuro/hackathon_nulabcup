"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";

export default function AuthButtons() {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return <div>Loading...</div>;
    }

    if (session) {
        return (
            <div className="flex flex-col items-center gap-4 p-4 border rounded-lg shadow-sm">
                <p>
                    ログイン中: {session.user?.name}
                </p>
                <Image
                    src={session.user?.image || ""}
                    alt="user image"
                    width={50}
                    height={50}
                    className="rounded-full"
                />
                <button
                    onClick={() => signOut()}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                >
                    ログアウト
                </button>
                
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 p-4 border rounded-lg shadow-sm">
            <p>ログインしていません</p>
            <button
                onClick={() => signIn("github")}
                className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition"
            >
                GitHubでログイン
            </button>
        </div>
    );
}
