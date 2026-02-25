import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocket } from "./useWebSocket";

// WebSocketモッククラス
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSING;
    if (this.onclose) {
      this.onclose(new CloseEvent("close"));
    }
    this.readyState = MockWebSocket.CLOSED;
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }

  static instances: MockWebSocket[] = [];
  static reset() {
    MockWebSocket.instances = [];
  }
}

describe("useWebSocket", () => {
  beforeEach(() => {
    MockWebSocket.reset();
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("初期ステータスは disconnected", () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useWebSocket({ url: "ws://localhost:8080/ws", onMessage }));
    expect(result.current.status).toBe("disconnected");
  });

  it("connect() 呼び出し後、ステータスが connecting になる", () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useWebSocket({ url: "ws://localhost:8080/ws", onMessage }));

    act(() => {
      result.current.connect();
    });

    expect(result.current.status).toBe("connecting");
  });

  it("WebSocket接続が開いたらステータスが connected になる", () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useWebSocket({ url: "ws://localhost:8080/ws", onMessage }));

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.status).toBe("connected");
  });

  it("メッセージを受信したら onMessage が呼ばれる", () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useWebSocket({ url: "ws://localhost:8080/ws", onMessage }));

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage({ type: "quiz", data: "test" });
    });

    expect(onMessage).toHaveBeenCalledWith({ type: "quiz", data: "test" });
  });

  it("エラー発生後はステータスが error になる", () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useWebSocket({ url: "ws://localhost:8080/ws", onMessage }));

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateError();
    });

    expect(result.current.status).toBe("error");
  });

  it("close() 呼び出し後はステータスが disconnected になる", () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useWebSocket({ url: "ws://localhost:8080/ws", onMessage }));

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      result.current.close();
    });

    expect(result.current.status).toBe("disconnected");
  });

  it("sendMessage は接続中のみメッセージを送信する", () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useWebSocket({ url: "ws://localhost:8080/ws", onMessage }));

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      result.current.sendMessage({ action: "join" });
    });

    expect(MockWebSocket.instances[0].sentMessages).toHaveLength(1);
    expect(JSON.parse(MockWebSocket.instances[0].sentMessages[0])).toEqual({ action: "join" });
  });
});
