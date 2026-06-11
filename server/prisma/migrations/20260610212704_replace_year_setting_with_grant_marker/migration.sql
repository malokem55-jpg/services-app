/*
  Warnings:

  - You are about to drop the `card_year_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `card_year_settings`;

-- CreateTable
CREATE TABLE `card_grant_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `last_grant_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
