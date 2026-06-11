-- CreateTable
CREATE TABLE `ui_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `show_bell_custom_payments` BOOLEAN NOT NULL DEFAULT true,
    `show_bell_monthly_payments` BOOLEAN NOT NULL DEFAULT true,
    `show_bell_iqama_soon` BOOLEAN NOT NULL DEFAULT true,
    `show_bell_iqama_expired` BOOLEAN NOT NULL DEFAULT true,
    `show_under_procedure_page` BOOLEAN NOT NULL DEFAULT true,
    `show_deleted_dues_page` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
