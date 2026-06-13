-- CreateTable
CREATE TABLE `malik_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `password_hash` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
