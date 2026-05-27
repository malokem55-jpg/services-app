/*
  Warnings:

  - You are about to drop the column `capacity` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `owner` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `organizations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `organizations` DROP COLUMN `capacity`,
    DROP COLUMN `owner`,
    DROP COLUMN `phone`,
    DROP COLUMN `type`;

-- AlterTable
ALTER TABLE `service_steps` ADD COLUMN `order` INTEGER NULL;
