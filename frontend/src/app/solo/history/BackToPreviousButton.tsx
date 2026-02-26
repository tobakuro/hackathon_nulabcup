"use client";

import { useRouter } from "next/navigation";

export default function BackToPreviousButton() {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/solo");
  }

  return (
    <button
      onClick={handleBack}
      className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      1人プレイへ戻る
    </button>
  );
}
