"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type WebSocketStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: unknown) => void;
}

interface UseWebSocketReturn {
  status: WebSocketStatus;
  connect: () => void;
  sendMessage: (data: unknown) => void;
  close: () => void;
}

export function useWebSocket({ url, onMessage }: UseWebSocketOptions): UseWebSocketReturn {
  const [status, setStatus] = useState<WebSocketStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // StrictMode で2回マウントされても閉じないためのフラグ
  const intentionalCloseRef = useRef(false);

  const close = useCallback(() => {
    intentionalCloseRef.current = true;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const connect = useCallback(() => {
    // 既に接続中・接続済みなら何もしない
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.CONNECTING ||
        wsRef.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    intentionalCloseRef.current = false;
    setStatus("connecting");
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      console.log("[useWebSocket] raw message:", event.data);
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current(data);
      } catch {
        onMessageRef.current(event.data);
      }
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        // 意図しない切断のみ状態を更新
        if (!intentionalCloseRef.current) {
          setStatus((prev) => (prev === "error" ? "error" : "disconnected"));
        }
      }
    };

    wsRef.current = ws;
  }, [url]);

  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // アンマウント時のみ閉じる（StrictMode の一時アンマウントでは閉じない）
  useEffect(() => {
    return () => {
      // クリーンアップは意図的 close として扱わない（再マウント時に再接続できるよう）
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { status, connect, sendMessage, close };
}
