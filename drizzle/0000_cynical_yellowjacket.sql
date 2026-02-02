CREATE TABLE `group_config` (
	`group_id` text PRIMARY KEY NOT NULL,
	`prefix` text DEFAULT '!',
	`autosticker` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_admin` integer DEFAULT 0,
	`is_owner` integer DEFAULT 0,
	`last_active` integer DEFAULT 1770024022
);
--> statement-breakpoint
CREATE TABLE `player_stats` (
	`user_id` text PRIMARY KEY NOT NULL,
	`level` integer DEFAULT 1,
	`xp` integer DEFAULT 0,
	`hp` integer DEFAULT 100,
	`mp` integer DEFAULT 50,
	`gold` integer DEFAULT 0,
	`bank` integer DEFAULT 0,
	`bank_interest` integer DEFAULT 15,
	`class` text DEFAULT 'warrior',
	`strength` integer DEFAULT 10,
	`defense` integer DEFAULT 10,
	`agility` integer DEFAULT 10,
	`magic` integer DEFAULT 10,
	`battles_won` integer DEFAULT 0,
	`battles_lost` integer DEFAULT 0,
	`quests_completed` integer DEFAULT 0,
	`items_collected` integer DEFAULT 0,
	`last_active` integer DEFAULT 1770024023,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
