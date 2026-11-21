CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_by" integer,
	"scopes" text DEFAULT 'ingest:write,fleet:read' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "fleet_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_name" text DEFAULT 'Warehouse A: Zone B' NOT NULL,
	"robot_id" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "robot_activity_columns" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_name" text DEFAULT 'Warehouse A: Zone B' NOT NULL,
	"column_index" integer NOT NULL,
	"day" text NOT NULL,
	"dots" integer NOT NULL,
	"date_label" text NOT NULL,
	"missions" integer NOT NULL,
	"delta" text NOT NULL,
	"highlighted" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "robot_telemetry_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"robot_id" text NOT NULL,
	"zone_name" text NOT NULL,
	"status" text NOT NULL,
	"efficiency" integer NOT NULL,
	"battery_health" integer NOT NULL,
	"task_completion" integer NOT NULL,
	"completed_tasks" integer NOT NULL,
	"has_cargo" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'api-ingest' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "robots" (
	"id" text PRIMARY KEY NOT NULL,
	"zone_name" text DEFAULT 'Warehouse A: Zone B' NOT NULL,
	"role" text NOT NULL,
	"efficiency" integer NOT NULL,
	"completed_tasks" integer NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"battery_health" integer NOT NULL,
	"task_completion" integer NOT NULL,
	"accent_color" text DEFAULT 'orange' NOT NULL,
	"has_cargo" boolean DEFAULT false NOT NULL,
	"path_index" integer DEFAULT 0 NOT NULL,
	"initial_progress" real DEFAULT 0 NOT NULL,
	"speed" real DEFAULT 0.015 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"job_title" text DEFAULT 'Fleet Manager' NOT NULL,
	"role" text DEFAULT 'operator' NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "zone_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_name" text NOT NULL,
	"date_range" text NOT NULL,
	"efficiency" integer NOT NULL,
	"robots" integer NOT NULL,
	"tasks" integer NOT NULL,
	"on_time" real NOT NULL,
	"active_missions" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_alerts" ADD CONSTRAINT "fleet_alerts_robot_id_robots_id_fk" FOREIGN KEY ("robot_id") REFERENCES "public"."robots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_telemetry_logs" ADD CONSTRAINT "robot_telemetry_logs_robot_id_robots_id_fk" FOREIGN KEY ("robot_id") REFERENCES "public"."robots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_zone_col_idx" ON "robot_activity_columns" USING btree ("zone_name","column_index");--> statement-breakpoint
CREATE UNIQUE INDEX "zone_metrics_zone_date_idx" ON "zone_metrics" USING btree ("zone_name","date_range");