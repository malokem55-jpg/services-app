-- تصحيح: قيم يوم الاستلام التي نُقلت سابقًا من board_number لكنها خارج النطاق
-- الصالح (1-31) ليست أيامًا حقيقية (غالبًا رقم حدود قديم أو بيانات شاذة).
-- تُعاد إلى board_number ويُفرَّغ monthly_receipt_day — فقط حيث board_number فارغ
-- حتى لا نطمس رقم حدود حقيقيًا.
UPDATE `clients`
SET `board_number` = CAST(`monthly_receipt_day` AS CHAR),
    `monthly_receipt_day` = NULL
WHERE `monthly_receipt_day` IS NOT NULL
  AND (`monthly_receipt_day` < 1 OR `monthly_receipt_day` > 31)
  AND `board_number` IS NULL;
