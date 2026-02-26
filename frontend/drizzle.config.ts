import { defineConfig } from "drizzle-kit";

const getUserDbUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.USER || process.env.USERNAME;
  if (!user) throw new Error("USER/USERNAME environment variable is missing");
  const pgHost = process.env.PGHOST;
  if (pgHost && pgHost.startsWith("/")) {
    // Unixソケット: postgres://user@%2Ftmp/hackathon
    // pg-connection-string は %2F で始まる hostname をソケットパスとして扱う
    const encodedHost = encodeURIComponent(pgHost);
    return `postgres://${user}@${encodedHost}/hackathon`;
  }
  const host = pgHost || "localhost";
  return `postgres://${user}@${host}:5432/hackathon`;
};

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getUserDbUrl(),
  },
});
