-- تعبئة يوم الاستلام للعملاء الشهريين القدامى الذين تنقصهم القيمة، باستنتاجها
-- من سجل دفعاتهم الشهرية — فقط حين تتفق كل الدفعات على يوم واحد من الشهر (موثوق).
-- العملاء بأيام متعددة أو بلا سجل دفعات يبقون فارغين للإدخال اليدوي.
UPDATE `clients` c
JOIN (
  SELECT `client_id`, MIN(DAY(`received_date`)) AS day_val
  FROM `client_payment_monthlies`
  WHERE `received_date` IS NOT NULL
  GROUP BY `client_id`
  HAVING COUNT(DISTINCT DAY(`received_date`)) = 1
) d ON d.`client_id` = c.`id`
SET c.`monthly_receipt_day` = d.day_val
WHERE c.`payment_type` = 'شهري'
  AND c.`monthly_receipt_day` IS NULL;
