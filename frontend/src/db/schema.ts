import {
  pgTable,
  text,
  timestamp,
  varchar,
  jsonb,
  uuid,
  index,
  integer,
  boolean,
  bigint,
} from "drizzle-orm/pg-core";
import { type AIAnalysisReport } from "../app/actions/github";

export type BattleQuizSource = "my_repo" | "opponent_repo";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).unique().notNull(),
  githubLogin: varchar("github_login", { length: 255 }).notNull(),
  gnuBalance: integer("gnu_balance").notNull().default(1000),
  rate: integer("rate").notNull().default(1500),
  encryptedToken: text("encrypted_token").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
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

export const codeSessions = pgTable("code_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  repositoryId: uuid("repository_id")
    .references(() => repositories.id, { onDelete: "cascade" })
    .notNull(),
  roomId: uuid("room_id"),
  mode: varchar("mode", { length: 20 }).notNull().default("solo"),
  totalScore: integer("total_score").default(0).notNull(),
  totalQuestions: integer("total_questions").default(5).notNull(),
  completedQuestions: integer("completed_questions").default(0).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("in_progress"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// 対戦で生成・出題されたクイズの履歴
export const battleQuizzes = pgTable(
  "battle_quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // どの試合か（バックエンドのroom ID）
    roomId: uuid("room_id").notNull(),
    // 問題を生成したプレイヤーのユーザーID
    generatedByUserId: uuid("generated_by_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    // 問題のソース（自分のリポジトリか相手のリポジトリか）
    source: varchar("source", { length: 20 }).notNull(), // "my_repo" | "opponent_repo"
    // 問題が生成されたリポジトリ
    repositoryId: uuid("repository_id")
      .references(() => repositories.id, { onDelete: "set null" }),
    // ターン番号（1-indexed）
    turnIndex: integer("turn_index").notNull(),
    // 問題内容
    difficulty: varchar("difficulty", { length: 20 }).notNull(),
    questionText: text("question_text").notNull(),
    choices: jsonb("choices").$type<string[]>().notNull(),
    correctAnswer: text("correct_answer").notNull(),
    tips: text("tips").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    roomIdIdx: index("battle_quizzes_room_id_idx").on(table.roomId),
    generatedByUserIdIdx: index("battle_quizzes_generated_by_user_id_idx").on(table.generatedByUserId),
  }),
);

export const codeAnswers = pgTable(
  "code_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .references(() => codeSessions.id, { onDelete: "cascade" })
      .notNull(),
    questionIndex: integer("question_index").notNull(),
    targetFileId: uuid("target_file_id").notNull(),
    targetFilePath: varchar("target_file_path", { length: 1024 }).notNull(),
    targetLineNumber: integer("target_line_number").notNull(),
    targetLineContent: text("target_line_content").notNull(),
    answeredFilePath: varchar("answered_file_path", { length: 1024 }),
    answeredLineNumber: integer("answered_line_number"),
    isCorrectFile: boolean("is_correct_file"),
    lineDifference: integer("line_difference"),
    score: integer("score").default(0).notNull(),
    timeSpentMs: integer("time_spent_ms"),
    answeredAt: timestamp("answered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index("code_answers_session_id_idx").on(table.sessionId),
  }),
);
