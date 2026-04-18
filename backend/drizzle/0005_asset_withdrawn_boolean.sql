ALTER TABLE "assets" ADD COLUMN "withdrawn" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "assets" SET "withdrawn" = true WHERE "withdrawn_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "withdrawn_at";
