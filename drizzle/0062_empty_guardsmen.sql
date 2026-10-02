CREATE TABLE "led_power_source_texts" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
