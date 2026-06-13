-- AlterTable
ALTER TABLE `organization_credentials` ADD COLUMN `city` VARCHAR(32) NULL;

-- CreateTable
CREATE TABLE `chamber_cities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `login_url` VARCHAR(500) NOT NULL DEFAULT '',

    UNIQUE INDEX `chamber_cities_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
