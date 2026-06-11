-- AlterTable
ALTER TABLE `client_payment_monthlies` ADD COLUMN `carried_from_month` VARCHAR(191) NULL,
    ADD COLUMN `carried_over_amount` DOUBLE NULL;
