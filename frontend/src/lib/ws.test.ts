import { describe, it, expect, afterEach } from "vitest";
import { getWsUrl } from "./ws";

describe("getWsUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("NEXT_PUBLIC_WS_URL が未設定の場合はデフォルト値を使用する", () => {
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "");
    expect(getWsUrl("/ws")).toBe("ws://localhost:8080/ws");
  });

  it("NEXT_PUBLIC_WS_URL が設定されている場合はそれを使用する", () => {
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "wss://example.com");
    expect(getWsUrl("/ws")).toBe("wss://example.com/ws");
  });

  it("末尾スラッシュが重複しないようにトリムされる", () => {
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "wss://example.com/");
    expect(getWsUrl("/ws")).toBe("wss://example.com/ws");
  });

  it("複数の末尾スラッシュもトリムされる", () => {
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "wss://example.com///");
    expect(getWsUrl("/ws")).toBe("wss://example.com/ws");
  });

  it("path が / で始まらない場合でも先頭スラッシュが補完される", () => {
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "wss://example.com");
    expect(getWsUrl("ws")).toBe("wss://example.com/ws");
  });

  it("ネストされたパスも正しく結合される", () => {
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "wss://example.com");
    expect(getWsUrl("/room/123")).toBe("wss://example.com/room/123");
  });
});
