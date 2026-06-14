-- عكس الديفولت: التوليد بعد انتهاء الإقامة صار مفعَّلاً افتراضياً للعملاء الجدد
ALTER TABLE `clients`
  ALTER COLUMN `generate_monthly_after_iqama` SET DEFAULT true;

-- تفعيله على كل العملاء الشهريين الحاليين المعطَّل عندهم الخيار. التوليد الفعلي
-- للدفعية القادمة يتكفّل به الفحص الدوري عند الإقلاع (ensureUpcomingInstallment)
-- بلا تعويض رجعي — دفعية واحدة في أقرب يوم استلام قادم فقط.
UPDATE `clients`
SET `generate_monthly_after_iqama` = true
WHERE `payment_type` = 'شهري'
  AND `generate_monthly_after_iqama` = false;
