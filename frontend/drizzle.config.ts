import { defineConfig } from "drizzle-kit";

const getUserDbUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.USER;
  if (!user) throw new Error("USER environment variable is missing");
  let url = `postgres://${user}@localhost:5432/hackathon`;
  if (process.env.PGHOST) {
    url += `?host=${process.env.PGHOST}`;
  }
  return url;
};

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getUserDbUrl(),
  },
});
