"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const [botStatus, setBotStatus] = useState<string | null>(null);
  const [botLoading, setBotLoading] = useState(false);

  const wsUrl = getWsUrl(
    `/ws/matchmake?github_login=${encodeURIComponent(user.github_login)}&github_id=${user.github_id}`,
  );

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
    [router],
  );

  const { status, connect, sendMessage, close } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
  });

  const handleStart = () => {
    setError(null);
    setBotStatus(null);
    setMatchmaking(true);
    connect();
  };

  const handleCancel = () => {
    sendMessage({ type: "act_cancel_matchmaking" });
    close();
    setMatchmaking(false);
    setBotStatus(null);
  };

  const handleRetry = () => {
    setError(null);
    handleStart();
  };

  // DEV: Bot と対戦 — 自分をキューに入れてから Bot も投入する
  const handleBotMatch = async () => {
    if (process.env.NODE_ENV !== "development") return;
    setBotStatus(null);
    setError(null);

    // まず自分をキューに入れる
    setMatchmaking(true);
    connect();

    // WS 接続が安定するまで待ってから Bot を投入
    setBotLoading(true);
    await new Promise((r) => setTimeout(r, 800));

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const res = await fetch(`${apiBase}/api/dev/start-bot-match`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setBotStatus("🤖 Bot をキューに追加しました。マッチング中...");
      } else {
        setBotStatus(data.message || data.error || "Bot の追加に失敗");
      }
    } catch {
      setBotStatus("API 接続エラー");
    } finally {
      setBotLoading(false);
    }
  };

  const isDisconnectedWithError = status === "error";

  useEffect(() => {
    if (matchmaking && status === "disconnected" && !isDisconnectedWithError) {
      setMatchmaking(false);
      setError("接続が切断されました");
    }
  }, [matchmaking, status, isDisconnectedWithError]);

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* Error Alert */}
      {error && (
        <div className="w-full p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm text-center">
          <span className="font-medium">⚠️ {error}</span>
        </div>
      )}

      {matchmaking && !isDisconnectedWithError ? (
        <div className="flex flex-col items-center gap-5 w-full py-4">
          {/* Animated searching indicator */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
            <span className="absolute inset-0 flex items-center justify-center text-2xl">🔍</span>
          </div>
          <div className="text-center">
            <p className="font-medium text-zinc-900 dark:text-white">対戦相手を探しています...</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">しばらくお待ちください</p>
          </div>
          {botStatus && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">{botStatus}</p>
          )}
          <button
            onClick={handleCancel}
            className="px-5 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-200"
          >
            キャンセル
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 w-full py-2">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            準備ができたらボタンを押してください
          </p>
          {isDisconnectedWithError ? (
            <button
              onClick={handleRetry}
              className="w-full px-6 py-3.5 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all duration-200"
            >
              🔄 再試行
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="w-full px-6 py-3.5 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all duration-200"
            >
              ⚔️ 対戦を探す
            </button>
          )}

          {/* DEV 環境のみ表示 */}
          {process.env.NODE_ENV === "development" && (
            <button
              onClick={handleBotMatch}
              disabled={botLoading}
              className="w-full px-6 py-3 text-sm font-semibold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/40 hover:scale-[1.01] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {botLoading ? "⏳ Bot を準備中..." : "🤖 DEV: Bot と対戦する"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
