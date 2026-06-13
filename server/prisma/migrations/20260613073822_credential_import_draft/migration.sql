-- CreateTable
CREATE TABLE `credential_import_drafts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payload` TEXT NOT NULL,
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
