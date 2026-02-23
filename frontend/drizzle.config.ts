import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        // PGHOST = UNIX socket from Devbox, or fallback to localhost
        url: process.env.DATABASE_URL || `postgres://${process.env.USER}@localhost:5432/hackathon?host=${process.env.PGHOST}`,
    },
});
