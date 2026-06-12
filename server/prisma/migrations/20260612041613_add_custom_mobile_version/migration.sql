-- AlterTable
ALTER TABLE `ui_settings` ADD COLUMN `show_custom_mobile_version` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `mobile_fill` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fill_key` VARCHAR(64) NOT NULL,
    `organization_id` INTEGER NULL,
    `platform` VARCHAR(32) NULL,
    `armed_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
