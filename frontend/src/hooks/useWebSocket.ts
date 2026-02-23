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

  const close = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

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
        setStatus((prev) => (prev === "error" ? "error" : "disconnected"));
      }
    };

    wsRef.current = ws;
  }, [url]);

  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { status, connect, sendMessage, close };
}
