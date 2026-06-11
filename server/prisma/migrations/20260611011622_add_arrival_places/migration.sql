-- AlterTable
ALTER TABLE `clients` ADD COLUMN `arrival_place_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `arrival_places` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_arrival_place_id_fkey` FOREIGN KEY (`arrival_place_id`) REFERENCES `arrival_places`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
