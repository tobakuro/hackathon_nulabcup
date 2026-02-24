import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const getUserDbUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.USER || process.env.USERNAME;
  if (!user) throw new Error("USER/USERNAME environment variable is missing");
  let url = `postgres://${user}@localhost:5432/hackathon`;
  if (process.env.PGHOST) {
    url += `?host=${process.env.PGHOST}`;
  }
  return url;
};

const pool = new Pool({
  connectionString: getUserDbUrl(),
});

export const db = drizzle(pool, { schema });
