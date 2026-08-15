CREATE TABLE `grading_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assessment_title` text NOT NULL,
	`student_number` integer NOT NULL,
	`student_name` text NOT NULL,
	`class_name` text NOT NULL,
	`question_scores` text NOT NULL,
	`question_maximums` text NOT NULL,
	`question_labels` text NOT NULL,
	`total_score` real NOT NULL,
	`maximum_score` real NOT NULL,
	`needs_review` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
