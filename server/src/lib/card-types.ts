// أنواع كروت العمل ومددها بالشهور — يجب أن تطابق CARD_TYPE_OPTIONS في client/src/lib/clientForm.ts
export const CARD_MONTHS: Record<string, number> = {
  'بدون': 0,
  '3 شهور': 3,
  '6 شهور': 6,
  '9 شهور': 9,
  'سنة': 12,
  'سنة و 3 شهور': 15,
  'سنة و 6 شهور': 18,
  'سنة و 9 شهور': 21,
  'سنتين': 24,
};

export const NO_CARD = 'بدون';

// رصيد كل مؤسسة لكل سنة هجرية
export const TOTAL_MONTHS_PER_HIJRI_YEAR = 48;
