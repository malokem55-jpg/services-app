import type { ClientFormData, OrgOption, ArrivalPlaceOption } from '../lib/clientForm'
import HijriDateInput from './HijriDateInput'

interface Props {
  form: ClientFormData
  onChange: (field: keyof ClientFormData, value: string) => void
  organizations: OrgOption[]
  errors?: Record<string, string>
  /** عميل تحت الإجراء (بدون رقم إقامة) — حقول الجواز والحدود والتأشيرة بدل الإقامة */
  underProcedure?: boolean
  /** عميل غير شهري يجري تحويله إلى شهري — يُظهر تنبيه محو السجل المالي القديم */
  convertingToMonthly?: boolean
  /** عميل شهري يجري تحويله إلى سنوي — حقول المبلغ المستلم والتاريخ إلزامية */
  convertingToYearly?: boolean
  /** مجموع الدفعيات المنجزة — لعرض المبلغ المدفوع والمتبقي (للقراءة فقط) */
  paidAmount?: number
  /** جهات القدوم — حقلها يظهر للعميل تحت الإجراء فقط */
  arrivalPlaces?: ArrivalPlaceOption[]
}

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white transition-colors min-h-11'

const inputErrCls =
  'w-full rounded-xl border border-red-400 bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 focus:bg-white transition-colors min-h-11'

const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-500">{msg}</p>
}

/**
 * حقول نافذة "تعديل بيانات العميل" — نفس حقول بطاقة تفاصيل العميل وبنفس ترتيبها.
 */
export default function ClientEditFormFields({
  form, onChange, organizations, errors = {},
  underProcedure = false, convertingToMonthly = false, convertingToYearly = false,
  paidAmount = 0,
  arrivalPlaces = [],
}: Props) {
  const ic = (field: string) => (errors[field] ? inputErrCls : inputCls)
  const isMonthly = form.paymentType === 'شهري'
  const remaining = (Number(form.amount) || 0) - paidAmount
  const readOnlyCls = inputCls + ' bg-gray-100 text-gray-500 cursor-not-allowed'

  return (
    <div className="space-y-3.5">

      {/* صف 1: اسم العميل | رقم الهاتف | المؤسسة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>اسم العميل</label>
          <input type="text" value={form.name} onChange={(e) => onChange('name', e.target.value)}
            placeholder="الاسم الكامل" className={ic('name')} />
          <FieldError msg={errors.name} />
        </div>
        <div>
          <label className={labelCls}>رقم الهاتف</label>
          <input type="tel" value={form.phone} onChange={(e) => onChange('phone', e.target.value)}
            placeholder="05xxxxxxxx" className={ic('phone')} />
          <FieldError msg={errors.phone} />
        </div>
        <div>
          <label className={labelCls}>المؤسسة</label>
          <select value={form.organizationId} onChange={(e) => onChange('organizationId', e.target.value)}
            className={ic('organizationId')}>
            <option value="">— اختر المؤسسة —</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <FieldError msg={errors.organizationId} />
        </div>
      </div>

      {underProcedure ? (
        <>
          {/* ══ تحت الإجراء ══ */}
          {/* صف 2: رقم الجواز | رقم الحدود | رقم التأشيرة */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>رقم الجواز</label>
              <input type="text" value={form.passport} onChange={(e) => onChange('passport', e.target.value)}
                placeholder="رقم الجواز" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>رقم الحدود</label>
              <input type="text" value={form.boardNumber} onChange={(e) => onChange('boardNumber', e.target.value)}
                placeholder="رقم الحدود" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>رقم التأشيرة</label>
              <input type="text" value={form.visaNumber} onChange={(e) => onChange('visaNumber', e.target.value)}
                placeholder="رقم التأشيرة" className={inputCls} />
            </div>
          </div>

          {/* صف 2.5: جهة القدوم — خاصية عميل تحت الإجراء فقط */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>جهة القدوم</label>
              <select value={form.arrivalPlaceId} onChange={(e) => onChange('arrivalPlaceId', e.target.value)}
                className={inputCls}>
                <option value="">— بدون —</option>
                {arrivalPlaces.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {arrivalPlaces.length === 0 && (
                <p className="mt-1 text-[11px] text-gray-400">تُضاف الجهات من صفحة الإعدادات</p>
              )}
            </div>
          </div>

          {/* صف 3: كرت العمل | تاريخ الدفعة القادمة | طريقة الدفع */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>كرت العمل</label>
              <input type="text" value={form.cardType || 'بدون'} readOnly className={readOnlyCls} />
              <p className="mt-1 text-[11px] text-gray-400">يُعدَّل عبر سجل الإصدارات في صفحة العميل</p>
            </div>
            <div>
              <label className={labelCls}>تاريخ الدفعة القادمة</label>
              <input type="date" value={form.nextPaymentDate} onChange={(e) => onChange('nextPaymentDate', e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>طريقة الدفع</label>
              <input type="text" value={form.paymentType || 'سنوي'} readOnly
                className={inputCls + ' bg-gray-100 text-gray-400 cursor-not-allowed'} />
              <FieldError msg={errors.paymentType} />
            </div>
          </div>

          {/* صف 4: المبلغ الإجمالي | المبلغ المدفوع | المبلغ المتبقي */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>المبلغ الإجمالي (ر.س)</label>
              <input type="number" min={0} value={form.amount} onChange={(e) => onChange('amount', e.target.value)}
                placeholder="0.00" className={ic('amount')} />
              <FieldError msg={errors.amount} />
            </div>
            <div>
              <label className={labelCls}>المبلغ المدفوع (ر.س)</label>
              <input type="text" value={paidAmount.toLocaleString('en-US')} readOnly className={readOnlyCls} />
            </div>
            <div>
              <label className={labelCls}>المبلغ المتبقي (ر.س)</label>
              <input type="text" value={remaining.toLocaleString('en-US')} readOnly className={readOnlyCls} />
            </div>
          </div>

          {/* صف 5: تنبيه التفويض والتصديق */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.tafweedAlertEnabled === '1'}
                onChange={(e) => onChange('tafweedAlertEnabled', e.target.checked ? '1' : '')}
                className="w-4 h-4 mt-0.5 accent-sky-500 cursor-pointer shrink-0"
              />
              <span className="text-xs font-semibold text-gray-600 leading-relaxed">
                تفعيل تنبيه التفويض لهذا العميل
              </span>
            </label>
            {form.tafweedAlertEnabled === '1' && (
              <div className="sm:max-w-60">
                <label className={labelCls}>تاريخ تنبيه التفويض والتصديق</label>
                <input
                  type="date"
                  value={form.tafweedAlertDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => onChange('tafweedAlertDate', e.target.value)}
                  className={ic('tafweedAlertDate')}
                />
                <FieldError msg={errors.tafweedAlertDate} />
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* ══ مكتمل (لديه إقامة) ══ */}
          {/* صف 2: رقم الإقامة | تاريخ انتهاء الإقامة | كرت العمل */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>رقم الإقامة</label>
              <input type="text" value={form.iqamaNumber} onChange={(e) => onChange('iqamaNumber', e.target.value)}
                placeholder="رقم الإقامة" className={ic('iqamaNumber')} />
              <FieldError msg={errors.iqamaNumber} />
            </div>
            <div>
              <label className={labelCls}>تاريخ انتهاء الإقامة</label>
              <HijriDateInput
                value={form.iqamaEndDate}
                onChange={(v) => onChange('iqamaEndDate', v)}
                defaultMode="hijri"
                hasError={!!errors.iqamaEndDate}
              />
              <FieldError msg={errors.iqamaEndDate} />
            </div>
            <div>
              <label className={labelCls}>كرت العمل</label>
              <input type="text" value={form.cardType || 'بدون'} readOnly className={readOnlyCls} />
              <p className="mt-1 text-[11px] text-gray-400">يُعدَّل عبر سجل الإصدارات في صفحة العميل</p>
            </div>
          </div>

          {convertingToMonthly && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                أدخل القسط الشهري الجديد ويوم الاستلام من كل شهر.
              </p>
            </div>
          )}
          {convertingToYearly && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                أدخل المبلغ الإجمالي الجديد والمبلغ المستلم وتاريخ الدفعة القادمة.
              </p>
            </div>
          )}

          {/* صف 3: حسب طريقة الدفع */}
          {isMonthly ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>طريقة الدفع</label>
                  <select value={form.paymentType} onChange={(e) => onChange('paymentType', e.target.value)}
                    className={ic('paymentType')}>
                    <option value="">— اختر —</option>
                    <option value="شهري">شهري</option>
                    <option value="سنوي">سنوي</option>
                  </select>
                  <FieldError msg={errors.paymentType} />
                </div>
                <div>
                  <label className={labelCls}>القسط الشهري (ر.س)</label>
                  <input type="number" min={0} value={form.amount} onChange={(e) => onChange('amount', e.target.value)}
                    placeholder="0.00" className={ic('amount')} />
                  <FieldError msg={errors.amount} />
                </div>
                <div>
                  <label className={labelCls}>يوم الاستلام من كل شهر</label>
                  <input type="number" min={1} max={31} value={form.boardNumber} onChange={(e) => onChange('boardNumber', e.target.value)}
                    placeholder="1 - 31" className={ic('boardNumber')} />
                  <FieldError msg={errors.boardNumber} />
                </div>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={form.generateMonthlyAfterIqama === '1'}
                  onChange={(e) => onChange('generateMonthlyAfterIqama', e.target.checked ? '1' : '')}
                  className="w-4 h-4 mt-0.5 accent-sky-500 cursor-pointer shrink-0"
                />
                <span className="text-xs font-semibold text-gray-600 leading-relaxed">
                  توليد تنبيهات دفعيات شهرية لهذا العميل حتى إذا كانت إقامته منتهية
                </span>
              </label>
            </>
          ) : (
            <>
              {/* صف 3: طريقة الدفع | المبلغ الإجمالي | المبلغ المدفوع */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>طريقة الدفع</label>
                  <select value={form.paymentType} onChange={(e) => onChange('paymentType', e.target.value)}
                    className={ic('paymentType')}>
                    <option value="">— اختر —</option>
                    <option value="شهري">شهري</option>
                    <option value="سنوي">سنوي</option>
                  </select>
                  <FieldError msg={errors.paymentType} />
                </div>
                <div>
                  <label className={labelCls}>المبلغ الإجمالي (ر.س)</label>
                  <input type="number" min={0} value={form.amount} onChange={(e) => onChange('amount', e.target.value)}
                    placeholder="0.00" className={ic('amount')} />
                  <FieldError msg={errors.amount} />
                </div>
                {convertingToYearly ? (
                  <div>
                    <label className={labelCls}>المبلغ المستلم (ر.س)</label>
                    <input type="number" min={0} value={form.receivedAmount}
                      onChange={(e) => onChange('receivedAmount', e.target.value)}
                      placeholder="0.00" className={ic('receivedAmount')} />
                    <FieldError msg={errors.receivedAmount} />
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>المبلغ المدفوع (ر.س)</label>
                    <input type="text" value={paidAmount.toLocaleString('en-US')} readOnly className={readOnlyCls} />
                  </div>
                )}
              </div>

              {/* صف 4: المبلغ المتبقي | تاريخ الدفعة القادمة */}
              <div className="grid grid-cols-2 gap-3">
                {!convertingToYearly && (
                  <div>
                    <label className={labelCls}>المبلغ المتبقي (ر.س)</label>
                    <input type="text" value={remaining.toLocaleString('en-US')} readOnly className={readOnlyCls} />
                  </div>
                )}
                <div>
                  <label className={labelCls}>تاريخ الدفعة القادمة</label>
                  <input type="date" value={form.nextPaymentDate} onChange={(e) => onChange('nextPaymentDate', e.target.value)}
                    className={ic('nextPaymentDate')} />
                  <FieldError msg={errors.nextPaymentDate} />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
