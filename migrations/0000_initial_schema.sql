CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`company_id` text,
	`request_id` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_events_target_idx` ON `audit_events` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_idx` ON `audit_events` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `change_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`change_order_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`line_total_cents` integer NOT NULL,
	`item_type` text NOT NULL,
	FOREIGN KEY (`change_order_id`) REFERENCES `change_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `change_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`company_id` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`submitted_at` text,
	`responded_at` text,
	`responded_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`responded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`license_number` text,
	`website` text,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`address_line_1` text,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`zip` text NOT NULL,
	`service_radius_miles` integer DEFAULT 25 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`verified_at` text,
	`suspended_at` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_slug_unique` ON `companies` (`slug`);--> statement-breakpoint
CREATE INDEX `companies_search_idx` ON `companies` (`status`,`city`,`state`);--> statement-breakpoint
CREATE TABLE `company_members` (
	`company_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`company_id`, `user_id`),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `company_members_user_idx` ON `company_members` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `company_service_areas` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`zip` text,
	`radius_miles` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `company_service_areas_lookup_idx` ON `company_service_areas` (`state`,`city`,`zip`);--> statement-breakpoint
CREATE TABLE `company_verification_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`type` text NOT NULL,
	`file_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `disputes` (
	`id` text PRIMARY KEY NOT NULL,
	`support_request_id` text NOT NULL,
	`job_id` text,
	`invoice_id` text,
	`opened_by` text NOT NULL,
	`company_id` text,
	`resolution` text,
	`resolved_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`support_request_id`) REFERENCES `support_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `email_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`template` text NOT NULL,
	`recipient_hash` text NOT NULL,
	`provider_message_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`last_error_code` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`buyer_id` text NOT NULL,
	`company_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`buyer_id`, `company_id`),
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`company_id` text,
	`quote_request_id` text,
	`job_id` text,
	`invoice_id` text,
	`object_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`checksum_sha256` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`scan_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quote_request_id`) REFERENCES `quote_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_object_key_unique` ON `files` (`object_key`);--> statement-breakpoint
CREATE INDEX `files_quote_idx` ON `files` (`quote_request_id`);--> statement-breakpoint
CREATE INDEX `files_job_idx` ON `files` (`job_id`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key` text NOT NULL,
	`actor_id` text NOT NULL,
	`operation` text NOT NULL,
	`request_hash` text NOT NULL,
	`response_json` text NOT NULL,
	`status_code` integer NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	PRIMARY KEY(`key`, `actor_id`, `operation`),
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idempotency_expiry_idx` ON `idempotency_keys` (`expires_at`);--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`line_total_cents` integer NOT NULL,
	`item_type` text NOT NULL,
	`cost_code` text,
	`work_phase` text,
	`change_order_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`change_order_id`) REFERENCES `change_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoice_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`recorded_by` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_at` text NOT NULL,
	`method` text NOT NULL,
	`reference` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoice_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`old_status` text,
	`new_status` text NOT NULL,
	`changed_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`root_invoice_id` text,
	`previous_revision_id` text,
	`revision_number` integer DEFAULT 1 NOT NULL,
	`job_id` text NOT NULL,
	`company_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`created_by` text NOT NULL,
	`invoice_number` text NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`tax_rate_bps` integer DEFAULT 0 NOT NULL,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`retainage_rate_bps` integer DEFAULT 0 NOT NULL,
	`retainage_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer NOT NULL,
	`amount_paid_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`sent_at` text,
	`viewed_at` text,
	`paid_at` text,
	`voided_at` text,
	`pdf_file_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_company_number_unique` ON `invoices` (`company_id`,`invoice_number`);--> statement-breakpoint
CREATE INDEX `invoices_job_idx` ON `invoices` (`job_id`,`revision_number`);--> statement-breakpoint
CREATE INDEX `invoices_buyer_idx` ON `invoices` (`buyer_id`,`status`);--> statement-breakpoint
CREATE TABLE `job_assignments` (
	`job_id` text NOT NULL,
	`user_id` text NOT NULL,
	`assigned_by` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`job_id`, `user_id`),
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`visibility` text DEFAULT 'company_only' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`old_status` text,
	`new_status` text NOT NULL,
	`changed_by` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_request_id` text NOT NULL,
	`accepted_proposal_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`company_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`title` text NOT NULL,
	`scope_summary` text NOT NULL,
	`site_address` text NOT NULL,
	`status` text DEFAULT 'accepted' NOT NULL,
	`start_date` text,
	`completion_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`quote_request_id`) REFERENCES `quote_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accepted_proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`thread_id`) REFERENCES `message_threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_quote_unique` ON `jobs` (`quote_request_id`);--> statement-breakpoint
CREATE INDEX `jobs_company_idx` ON `jobs` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `jobs_buyer_idx` ON `jobs` (`buyer_id`,`status`);--> statement-breakpoint
CREATE TABLE `message_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_request_id` text,
	`job_id` text,
	`company_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`subject` text NOT NULL,
	`last_message_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`quote_request_id`) REFERENCES `quote_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`edited_at` text,
	`deleted_at` text,
	FOREIGN KEY (`thread_id`) REFERENCES `message_threads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_thread_idx` ON `messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email_leads` integer DEFAULT true NOT NULL,
	`email_messages` integer DEFAULT true NOT NULL,
	`email_jobs` integer DEFAULT true NOT NULL,
	`email_invoices` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `proposal_items` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`line_total_cents` integer NOT NULL,
	`item_type` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_request_id` text NOT NULL,
	`company_id` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`valid_until` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`sent_at` text,
	`responded_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`quote_request_id`) REFERENCES `quote_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `proposals_quote_idx` ON `proposals` (`quote_request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `quote_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_id` text NOT NULL,
	`company_id` text NOT NULL,
	`service_id` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`project_address` text NOT NULL,
	`project_city` text NOT NULL,
	`project_state` text NOT NULL,
	`project_zip` text NOT NULL,
	`normalized_address` text,
	`latitude_e6` integer,
	`longitude_e6` integer,
	`job_description` text NOT NULL,
	`preferred_start_date` text,
	`budget_min_cents` integer,
	`budget_max_cents` integer,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quote_requests_buyer_idx` ON `quote_requests` (`buyer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `quote_requests_company_idx` ON `quote_requests` (`company_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`company_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_job_buyer_unique` ON `reviews` (`job_id`,`buyer_id`);--> statement-breakpoint
CREATE INDEX `reviews_company_idx` ON `reviews` (`company_id`,`status`);--> statement-breakpoint
CREATE TABLE `service_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_categories_slug_unique` ON `service_categories` (`slug`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`category_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`pricing_type` text DEFAULT 'quote' NOT NULL,
	`starting_price_cents` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `service_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_company_slug_unique` ON `services` (`company_id`,`slug`);--> statement-breakpoint
CREATE INDEX `services_category_idx` ON `services` (`category_id`,`active`);--> statement-breakpoint
CREATE TABLE `support_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_id` text,
	`type` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assigned_admin_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `thread_participants` (
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_read_at` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`thread_id`, `user_id`),
	FOREIGN KEY (`thread_id`) REFERENCES `message_threads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_user_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`platform_role` text DEFAULT 'buyer' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_clerk_user_id_unique` ON `users` (`clerk_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);