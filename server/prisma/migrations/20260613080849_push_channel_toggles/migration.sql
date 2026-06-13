-- AlterTable
ALTER TABLE `notification_settings` ADD COLUMN `push_custom_payment` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `push_iqama_expired` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `push_iqama_soon` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `push_monthly_payment` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `push_tafweed` BOOLEAN NOT NULL DEFAULT true;
