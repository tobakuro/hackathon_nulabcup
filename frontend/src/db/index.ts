import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
    // Use DEVBOX's configured PG connection or a fallback
    connectionString: process.env.DATABASE_URL || `postgres://${process.env.USER}@localhost:5432/hackathon?host=${process.env.PGHOST}`,
});

export const db = drizzle(pool, { schema });
