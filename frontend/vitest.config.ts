import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/**", "src/hooks/**", "src/components/**"],
      exclude: ["src/**/*.test.*", "src/test/**", "src/app/actions/**", "src/auth.ts", "src/db/**"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    conditions: ["browser", "import", "module", "default"],
  },
});
