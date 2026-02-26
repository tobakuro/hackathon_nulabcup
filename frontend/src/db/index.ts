import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const getDbUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // devbox ローカル開発用フォールバック
  const user = process.env.USER || process.env.USERNAME;
  if (!user) throw new Error("DATABASE_URL environment variable is required");
  const pgHost = process.env.PGHOST;
  if (pgHost) return `postgres://${user}@/hackathon?host=${pgHost}`;
  return `postgres://${user}@localhost:5432/hackathon`;
};

const pool = new Pool({
  connectionString: getDbUrl(),
});

export const db = drizzle(pool, { schema });
