-- AlterTable
ALTER TABLE `client_payment_monthlies` ADD COLUMN `after_iqama` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `clients` ADD COLUMN `generate_monthly_after_iqama` BOOLEAN NOT NULL DEFAULT false;
