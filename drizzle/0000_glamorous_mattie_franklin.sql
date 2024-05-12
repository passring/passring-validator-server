CREATE TABLE IF NOT EXISTS "keys" (
	"publicKey" varchar(256) PRIMARY KEY NOT NULL,
	"vote_id" varchar,
	"email" varchar(128),
	"name" varchar(256),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "votings" (
	"id" varchar PRIMARY KEY NOT NULL,
	"active" boolean,
	"allowed_participants" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
