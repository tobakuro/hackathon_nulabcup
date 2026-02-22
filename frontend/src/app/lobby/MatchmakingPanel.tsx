"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getWsUrl } from "@/lib/ws";

interface MatchmakingPanelProps {
  user: { id: string; name: string; image: string; github_login: string; github_id: number };
}

interface WsMessage {
  type: string;
  payload?: {
    room_id?: string;
    message?: string;
  };
}

export default function MatchmakingPanel({ user }: MatchmakingPanelProps) {
  const router = useRouter();
  const [matchmaking, setMatchmaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMessage = useCallback(
    (data: unknown) => {
      console.log("[MatchmakingPanel] WS message received:", JSON.stringify(data));
      const msg = data as WsMessage;
      switch (msg.type) {
        case "ev_queue_joined":
          setMatchmaking(true);
          break;
        case "ev_match_found":
          console.log("[MatchmakingPanel] ev_match_found payload:", JSON.stringify(msg.payload));
          if (msg.payload?.room_id) {
            console.log("[MatchmakingPanel] navigating to /room/" + msg.payload.room_id);
            router.push(`/room/${msg.payload.room_id}`);
          } else {
            console.warn("[MatchmakingPanel] ev_match_found but no room_id in payload");
          }
          break;
        case "ev_error":
          setError(msg.payload?.message ?? "エラーが発生しました");
          setMatchmaking(false);
          break;
      }
    },
    [router]
  );

  const wsUrl = getWsUrl(`/ws/matchmake?github_login=${encodeURIComponent(user.github_login)}&github_id=${user.github_id}`);
  const { status, connect, sendMessage, close } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
  });

  const handleStart = () => {
    setError(null);
    setMatchmaking(true);
    connect();
  };

  const handleCancel = () => {
    sendMessage({ type: "act_cancel_matchmaking" });
    close();
    setMatchmaking(false);
  };

  const handleRetry = () => {
    setError(null);
    handleStart();
  };

  const [testBotStatus, setTestBotStatus] = useState<string | null>(null);

  const handleAddTestUser = async () => {
    setTestBotStatus("追加中...");
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const res = await fetch(`${apiBase}/api/dev/enqueue-test-user`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTestBotStatus("test-bot をキューに追加しました");
      } else {
        setTestBotStatus(data.message || data.error || "追加に失敗");
      }
    } catch {
      setTestBotStatus("API接続エラー");
    }
  };

  const isDisconnectedWithError = status === "error";

  return (
    <div className="flex flex-col items-center gap-6 p-6 border rounded-lg shadow-sm w-full min-w-[300px]">
      <div className="flex items-center gap-3">
        {user.image && (
          <Image
            src={user.image}
            alt={user.name}
            width={40}
            height={40}
            className="rounded-full"
          />
        )}
        <span className="text-zinc-900 dark:text-white font-medium">{user.name}</span>
      </div>

      {error && (
        <div className="w-full p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {matchmaking && !isDisconnectedWithError ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-zinc-200 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400 rounded-full animate-spin" />
          <p className="text-zinc-600 dark:text-zinc-400">対戦相手を探しています...</p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition"
            >
              キャンセル
            </button>
            <button
              onClick={handleAddTestUser}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition text-sm"
            >
              DEV: Bot追加
            </button>
          </div>
          {testBotStatus && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{testBotStatus}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          {isDisconnectedWithError ? (
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              再試行
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              対戦を探す
            </button>
          )}
        </div>
      )}
    </div>
  );
}
