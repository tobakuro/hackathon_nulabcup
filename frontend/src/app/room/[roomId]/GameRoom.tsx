"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getWsUrl } from "@/lib/ws";

interface GameRoomProps {
  roomId: string;
  user: { id: string; name: string };
}

export default function GameRoom({ roomId, user }: GameRoomProps) {
  const wsUrl = getWsUrl(`/ws/room/${roomId}?user_id=${encodeURIComponent(user.id)}`);
  const { status, connect } = useWebSocket({
    url: wsUrl,
    onMessage: () => {
      // ゲームロジックは別Issueで実装
    },
  });

  useEffect(() => {
    connect();
  }, [connect]);

  const statusLabel: Record<string, string> = {
    connecting: "接続中...",
    connected: "接続完了",
    disconnected: "切断",
    error: "接続エラー",
  };

  const statusColor: Record<string, string> = {
    connecting: "text-yellow-500",
    connected: "text-green-500",
    disconnected: "text-zinc-400",
    error: "text-red-500",
  };

  return (
    <div className="flex flex-col items-center gap-6 min-w-[300px]">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        ルーム: {roomId}
      </h1>

      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full inline-block ${
            status === "connected"
              ? "bg-green-500"
              : status === "connecting"
              ? "bg-yellow-500 animate-pulse"
              : status === "error"
              ? "bg-red-500"
              : "bg-zinc-400"
          }`}
        />
        <span className={`text-sm ${statusColor[status]}`}>
          {statusLabel[status]}
        </span>
      </div>

      <div className="p-6 border rounded-lg w-full text-center text-zinc-500 dark:text-zinc-400">
        ゲーム画面（準備中）
      </div>

      <Link
        href="/lobby"
        className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition"
      >
        ロビーに戻る
      </Link>
    </div>
  );
}
