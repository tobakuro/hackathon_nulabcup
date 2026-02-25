import {
  pgTable,
  text,
  timestamp,
  varchar,
  jsonb,
  uuid,
  index,
  integer,
  bigint,
} from "drizzle-orm/pg-core";
import { type AIAnalysisReport } from "../app/actions/github";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).unique().notNull(),
  githubLogin: varchar("github_login", { length: 255 }).notNull(),
  gnuBalance: integer("gnu_balance").notNull().default(1000),
  rate: integer("rate").notNull().default(1500),
  encryptedToken: text("encrypted_token").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const repositories = pgTable("repositories", {
  id: uuid("id").primaryKey().defaultRandom(),
  owner: varchar("owner", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 511 }).unique().notNull(),
  summaryJson: jsonb("summary_json").$type<AIAnalysisReport | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const repositoryFiles = pgTable(
  "repository_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .references(() => repositories.id, { onDelete: "cascade" })
      .notNull(),
    filePath: varchar("file_path", { length: 1024 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    repositoryIdIdx: index("repository_files_repository_id_idx").on(table.repositoryId),
  }),
);
