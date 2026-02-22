export function getWsUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";
  return `${base}${path}`;
}
