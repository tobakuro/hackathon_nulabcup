export function isQuizCandidatePath(path: string): boolean {
  const lower = path.toLowerCase();
  if (lower === "readme.md" || lower.endsWith("/readme.md")) return false;
  if (lower.includes("/docs/") || lower.startsWith("docs/")) return false;
  return (
    lower.endsWith(".ts") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".js") ||
    lower.endsWith(".jsx") ||
    lower.endsWith(".go") ||
    lower.endsWith(".py") ||
    lower.endsWith(".php") ||
    lower.endsWith(".dart") ||
    lower.endsWith(".cs") ||
    lower.endsWith(".rb")
  );
}
