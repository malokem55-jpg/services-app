-- AlterTable
ALTER TABLE `clients` ADD COLUMN `monthly_receipt_day` INTEGER NULL;

-- نقل يوم الاستلام من حقل رقم الحدود (board_number) إلى الحقل المستقل الجديد
-- للعملاء الشهريين فقط، ثم تفريغ board_number لهم (كان يحمل يوم الاستلام لا رقم حدود)
UPDATE `clients`
SET `monthly_receipt_day` = CAST(`board_number` AS UNSIGNED),
    `board_number` = NULL
WHERE `payment_type` = 'شهري'
  AND `board_number` REGEXP '^[0-9]+$';
