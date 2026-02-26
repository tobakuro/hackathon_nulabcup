import { defineConfig } from "drizzle-kit";

const getDbUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.USER || process.env.USERNAME;
  if (!user) throw new Error("USER/USERNAME environment variable is missing");
  const pgHost = process.env.PGHOST || "localhost";
  if (pgHost.startsWith("/")) {
    return `postgres://${user}@/hackathon?host=${pgHost}`;
  }
  return `postgres://${user}@${pgHost}:5432/hackathon`;
};

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getDbUrl(),
  },
});
