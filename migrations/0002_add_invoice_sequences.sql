CREATE TABLE `invoice_sequences` (
	`company_id` text NOT NULL,
	`year` integer NOT NULL,
	`next_number` integer NOT NULL,
	PRIMARY KEY(`company_id`, `year`),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
