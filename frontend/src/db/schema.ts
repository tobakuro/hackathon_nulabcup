import { pgTable, text, timestamp, varchar, jsonb, uuid } from "drizzle-orm/pg-core";
import { type AIAnalysisReport } from "../app/actions/github";

export const repositories = pgTable("repositories", {
    id: uuid("id").primaryKey().defaultRandom(),
    owner: varchar("owner", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 511 }).unique().notNull(),
    summaryJson: jsonb("summary_json").$type<AIAnalysisReport | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const repositoryFiles = pgTable("repository_files", {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
        .references(() => repositories.id, { onDelete: "cascade" })
        .notNull(),
    filePath: varchar("file_path", { length: 1024 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
