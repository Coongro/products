CREATE TABLE "module_products_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"slug" text,
	"icon" text,
	"color" text,
	"order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_products_products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" uuid,
	"sku" text,
	"barcode" text,
	"unit" text,
	"purchase_price" numeric,
	"sale_price" numeric,
	"tax_rate" numeric,
	"stock_current" numeric DEFAULT '0' NOT NULL,
	"stock_minimum" numeric DEFAULT '0' NOT NULL,
	"image_url" text,
	"tags" jsonb,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_products_variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"barcode" text,
	"purchase_price" numeric,
	"sale_price" numeric,
	"stock_current" numeric DEFAULT '0' NOT NULL,
	"stock_minimum" numeric DEFAULT '0' NOT NULL,
	"attributes" jsonb,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_products_stock_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"type" text NOT NULL,
	"quantity" numeric NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"unit_cost" numeric,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
