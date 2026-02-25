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

  const statusConfig: Record<string, { label: string; color: string; dotColor: string }> = {
    connecting: {
      label: "接続中...",
      color: "text-yellow-600 dark:text-yellow-400",
      dotColor: "bg-yellow-500 animate-pulse",
    },
    connected: {
      label: "接続完了",
      color: "text-emerald-600 dark:text-emerald-400",
      dotColor: "bg-emerald-500",
    },
    disconnected: {
      label: "切断",
      color: "text-zinc-500 dark:text-zinc-400",
      dotColor: "bg-zinc-400",
    },
    error: {
      label: "接続エラー",
      color: "text-red-600 dark:text-red-400",
      dotColor: "bg-red-500",
    },
  };

  const currentStatus = statusConfig[status] ?? statusConfig.disconnected;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Room Header */}
      <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white">🏟️ ゲームルーム</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
              ID: {roomId.slice(0, 8)}...
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <span className={`w-2 h-2 rounded-full ${currentStatus.dotColor}`} />
            <span className={`text-xs font-medium ${currentStatus.color}`}>
              {currentStatus.label}
            </span>
          </div>
        </div>

        {/* Game Area */}
        <div className="p-8">
          <div className="flex flex-col items-center justify-center gap-4 py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
            <span className="text-4xl">🎮</span>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">ゲーム画面（準備中）</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">プレイヤー: {user.name}</p>
          </div>
        </div>
      </div>

      {/* Back Link */}
      <Link
        href="/lobby"
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
      >
        ← ロビーに戻る
      </Link>
    </div>
  );
}
