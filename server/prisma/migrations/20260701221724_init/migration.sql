-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "username" TEXT,
    "phone" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "number" TEXT,
    "expired_date" DATE,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_platforms" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "login_url" VARCHAR(500) NOT NULL DEFAULT '',

    CONSTRAINT "login_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chamber_cities" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "login_url" VARCHAR(500) NOT NULL DEFAULT '',

    CONSTRAINT "chamber_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_credentials" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_enc" TEXT NOT NULL,
    "city" VARCHAR(32),
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "organization_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_steps" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "number" TEXT,
    "order" INTEGER,
    "service_id" INTEGER,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "service_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arrival_places" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "arrival_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "passport" TEXT,
    "board_number" TEXT,
    "visa_number" TEXT,
    "iqama_number" TEXT,
    "iqama_end_date" DATE,
    "card_type" TEXT DEFAULT 'بدون',
    "notes" TEXT,
    "payment_type" TEXT,
    "next_payment_date" DATE,
    "amount" DOUBLE PRECISION,
    "monthly_receipt_day" INTEGER,
    "generate_monthly_after_iqama" BOOLEAN NOT NULL DEFAULT true,
    "tafweed_alert_date" DATE,
    "tafweed_done" BOOLEAN NOT NULL DEFAULT false,
    "service_id" INTEGER,
    "organization_id" INTEGER,
    "last_step_id" INTEGER,
    "arrival_place_id" INTEGER,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_steps" (
    "id" SERIAL NOT NULL,
    "step_date" DATE,
    "client_id" INTEGER,
    "step_id" INTEGER,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "client_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_payments" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
    "amount" DOUBLE PRECISION,
    "next_payment_date" DATE,
    "is_done" BOOLEAN DEFAULT true,
    "last_payment" BOOLEAN DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "client_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_payment_monthlies" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
    "iqama_end_date" DATE,
    "month" TEXT,
    "received_date" DATE,
    "amount" DOUBLE PRECISION,
    "received_amount" DOUBLE PRECISION,
    "carried_over_amount" DOUBLE PRECISION,
    "carried_from_month" TEXT,
    "status" TEXT,
    "notes" TEXT,
    "after_iqama" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "client_payment_monthlies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deleted_client_dues" (
    "id" SERIAL NOT NULL,
    "client_name" TEXT,
    "phone" TEXT,
    "passport" TEXT,
    "iqama_number" TEXT,
    "service_name" TEXT,
    "organization_name" TEXT,
    "payment_type" TEXT,
    "total_due" DOUBLE PRECISION DEFAULT 0,
    "collected_amount" DOUBLE PRECISION DEFAULT 0,
    "status" TEXT DEFAULT 'pending',
    "details" JSONB,
    "collections" JSONB,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "deleted_client_dues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_issuances" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
    "client_name" TEXT,
    "organization_id" INTEGER NOT NULL,
    "card_type" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "hijri_year" INTEGER NOT NULL,
    "issued_at" DATE NOT NULL,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "card_issuances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_grant_settings" (
    "id" SERIAL NOT NULL,
    "last_grant_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_grant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" SERIAL NOT NULL,
    "endpoint" VARCHAR(500) NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" SERIAL NOT NULL,
    "cron_hour" INTEGER NOT NULL,
    "cron_minute" INTEGER NOT NULL,
    "push_monthly_payment" BOOLEAN NOT NULL DEFAULT true,
    "push_custom_payment" BOOLEAN NOT NULL DEFAULT true,
    "push_iqama_soon" BOOLEAN NOT NULL DEFAULT true,
    "push_iqama_expired" BOOLEAN NOT NULL DEFAULT true,
    "push_tafweed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ui_settings" (
    "id" SERIAL NOT NULL,
    "show_bell_custom_payments" BOOLEAN NOT NULL DEFAULT true,
    "show_bell_monthly_payments" BOOLEAN NOT NULL DEFAULT true,
    "show_bell_iqama_soon" BOOLEAN NOT NULL DEFAULT true,
    "show_bell_iqama_expired" BOOLEAN NOT NULL DEFAULT true,
    "show_bell_tafweed" BOOLEAN NOT NULL DEFAULT true,
    "show_under_procedure_page" BOOLEAN NOT NULL DEFAULT true,
    "show_deleted_dues_page" BOOLEAN NOT NULL DEFAULT true,
    "show_iqama_alerts_page" BOOLEAN NOT NULL DEFAULT false,
    "show_custom_mobile_version" BOOLEAN NOT NULL DEFAULT false,
    "run_on_mobile" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ui_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "malik_settings" (
    "id" SERIAL NOT NULL,
    "password_hash" VARCHAR(255),

    CONSTRAINT "malik_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_fill" (
    "id" SERIAL NOT NULL,
    "fill_key" VARCHAR(64) NOT NULL,
    "organization_id" INTEGER,
    "platform" VARCHAR(32),
    "armed_at" TIMESTAMP(3),

    CONSTRAINT "mobile_fill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_import_drafts" (
    "id" SERIAL NOT NULL,
    "payload" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "credential_import_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_day_changes" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
    "client_name" TEXT,
    "old_day" INTEGER,
    "new_day" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_day_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sent_push_notifications" (
    "id" SERIAL NOT NULL,
    "alert_type" TEXT NOT NULL,
    "reference_id" INTEGER NOT NULL,
    "reference_date" DATE NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_push_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "login_platforms_key_key" ON "login_platforms"("key");

-- CreateIndex
CREATE UNIQUE INDEX "chamber_cities_key_key" ON "chamber_cities"("key");

-- CreateIndex
CREATE UNIQUE INDEX "organization_credentials_organization_id_platform_key" ON "organization_credentials"("organization_id", "platform");

-- CreateIndex
CREATE INDEX "card_issuances_organization_id_hijri_year_idx" ON "card_issuances"("organization_id", "hijri_year");

-- CreateIndex
CREATE INDEX "card_issuances_client_id_idx" ON "card_issuances"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "receipt_day_changes_changed_at_idx" ON "receipt_day_changes"("changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "sent_push_notifications_alert_type_reference_id_reference_d_key" ON "sent_push_notifications"("alert_type", "reference_id", "reference_date");

-- AddForeignKey
ALTER TABLE "organization_credentials" ADD CONSTRAINT "organization_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_steps" ADD CONSTRAINT "service_steps_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_arrival_place_id_fkey" FOREIGN KEY ("arrival_place_id") REFERENCES "arrival_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_steps" ADD CONSTRAINT "client_steps_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_steps" ADD CONSTRAINT "client_steps_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "service_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payment_monthlies" ADD CONSTRAINT "client_payment_monthlies_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_issuances" ADD CONSTRAINT "card_issuances_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_issuances" ADD CONSTRAINT "card_issuances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_day_changes" ADD CONSTRAINT "receipt_day_changes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
