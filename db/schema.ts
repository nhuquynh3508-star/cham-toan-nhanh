import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gradingResults = sqliteTable(
  "grading_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerKey: text("owner_key")
      .notNull()
      .default("3d3078b9b320490d39c975c092db449d701a9207cc5d13163895ca6ed955624d"),
    assessmentTitle: text("assessment_title").notNull(),
    studentNumber: integer("student_number").notNull(),
    studentName: text("student_name").notNull(),
    className: text("class_name").notNull(),
    questionScores: text("question_scores").notNull(),
    questionMaximums: text("question_maximums").notNull(),
    questionLabels: text("question_labels").notNull(),
    totalScore: real("total_score").notNull(),
    maximumScore: real("maximum_score").notNull(),
    needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("grading_results_owner_assessment_idx").on(
      table.ownerKey,
      table.assessmentTitle,
    ),
  ],
);
