import { defineConfig } from "drizzle-kit";

const getDbCredentials = () => {
  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL };
  }
  const user = process.env.USER || process.env.USERNAME;
  if (!user) throw new Error("USER/USERNAME environment variable is missing");
  const pgHost = process.env.PGHOST || "localhost";
  return {
    host: pgHost,
    user,
    database: "hackathon",
  };
};

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: getDbCredentials(),
});
