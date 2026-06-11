-- CreateTable
CREATE TABLE `card_issuances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NULL,
    `client_name` VARCHAR(191) NULL,
    `organization_id` INTEGER NOT NULL,
    `card_type` VARCHAR(191) NOT NULL,
    `months` INTEGER NOT NULL,
    `hijri_year` INTEGER NOT NULL,
    `issued_at` DATE NOT NULL,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,

    INDEX `card_issuances_organization_id_hijri_year_idx`(`organization_id`, `hijri_year`),
    INDEX `card_issuances_client_id_idx`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `card_issuances` ADD CONSTRAINT `card_issuances_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `card_issuances` ADD CONSTRAINT `card_issuances_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
