ALTER TABLE `quote_requests` ADD `project_type` text DEFAULT 'General project' NOT NULL;
--> statement-breakpoint
ALTER TABLE `proposals` ADD `price_type` text DEFAULT 'fixed' NOT NULL;
--> statement-breakpoint
ALTER TABLE `proposals` ADD `price_min_cents` integer;
--> statement-breakpoint
ALTER TABLE `proposals` ADD `price_max_cents` integer;
--> statement-breakpoint
ALTER TABLE `proposals` ADD `assumptions` text;
--> statement-breakpoint
ALTER TABLE `proposals` ADD `notes` text;
