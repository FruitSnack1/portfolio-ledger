CREATE TABLE "asset_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"deposit" numeric(18, 4) NOT NULL,
	"balance" numeric(18, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_logs" ADD CONSTRAINT "asset_logs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_logs_asset_id_idx" ON "asset_logs" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_logs_asset_year_month_uidx" ON "asset_logs" USING btree ("asset_id","year","month");