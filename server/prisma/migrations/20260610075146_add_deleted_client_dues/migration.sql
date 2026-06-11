-- CreateTable
CREATE TABLE `deleted_client_dues` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_name` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `passport` VARCHAR(191) NULL,
    `iqama_number` VARCHAR(191) NULL,
    `service_name` VARCHAR(191) NULL,
    `organization_name` VARCHAR(191) NULL,
    `payment_type` VARCHAR(191) NULL,
    `total_due` DOUBLE NULL DEFAULT 0,
    `collected_amount` DOUBLE NULL DEFAULT 0,
    `status` VARCHAR(191) NULL DEFAULT 'pending',
    `details` JSON NULL,
    `collections` JSON NULL,
    `notes` TEXT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
