export function getWsUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080").replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
