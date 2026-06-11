-- CreateTable
CREATE TABLE `card_year_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `active_hijri_year` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
