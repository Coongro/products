CREATE TABLE "module_products_batches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"batch_number" text NOT NULL,
	"expiration_date" timestamp,
	"quantity" numeric NOT NULL,
	"purchase_date" timestamp,
	"purchase_price" numeric,
	"supplier" text,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
