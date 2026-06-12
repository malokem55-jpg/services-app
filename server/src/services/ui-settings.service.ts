import prisma from '../lib/prisma.js';

export interface UiSettings {
  showBellCustomPayments: boolean;
  showBellMonthlyPayments: boolean;
  showBellIqamaSoon: boolean;
  showBellIqamaExpired: boolean;
  showUnderProcedurePage: boolean;
  showDeletedDuesPage: boolean;
  showIqamaAlertsPage: boolean;
  showCustomMobileVersion: boolean;
}

const DEFAULTS: UiSettings = {
  showBellCustomPayments: true,
  showBellMonthlyPayments: true,
  showBellIqamaSoon: true,
  showBellIqamaExpired: true,
  showUnderProcedurePage: true,
  showDeletedDuesPage: true,
  showIqamaAlertsPage: false,
  showCustomMobileVersion: false,
};

export async function getUiSettings(): Promise<UiSettings> {
  const setting = await prisma.uiSetting.findFirst();
  if (!setting) return DEFAULTS;
  const { id: _id, ...rest } = setting;
  return rest;
}

export async function updateUiSettings(patch: Partial<UiSettings>): Promise<UiSettings> {
  const current = await getUiSettings();
  const next = { ...current, ...patch };
  // صفحة عملاء تنبيهات الإقامات تحل محل جرسي الإقامات: إخفاؤها يعيد الجرسين إجبارياً
  if (patch.showIqamaAlertsPage === false) {
    next.showBellIqamaSoon = true;
    next.showBellIqamaExpired = true;
  }
  // وما دامت ظاهرة يبقى الجرسان مخفيين مهما كان الطلب
  if (next.showIqamaAlertsPage) {
    next.showBellIqamaSoon = false;
    next.showBellIqamaExpired = false;
  }
  await prisma.uiSetting.upsert({
    where: { id: 1 },
    update: next,
    create: { id: 1, ...next },
  });
  return next;
}
