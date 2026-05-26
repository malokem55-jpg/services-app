import type { ClientFormData, ServiceOption, OrgOption, ServiceStepOption, StepFormEntry } from '../lib/clientForm'
import { CARD_TYPE_OPTIONS } from '../lib/clientForm'

interface Props {
  form: ClientFormData
  onChange: (field: keyof ClientFormData, value: string) => void
  services: ServiceOption[]
  organizations: OrgOption[]
  serviceSteps?: ServiceStepOption[]
  stepEntries?: StepFormEntry[]
  onStepChange?: (stepId: number, field: 'date' | 'done', value: string | boolean) => void
}

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white transition-colors min-h-11'

const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

export default function ClientFormFields({
  form, onChange, services, organizations,
  serviceSteps = [], stepEntries = [], onStepChange,
}: Props) {
  const isIqama = serviceSteps.length > 0
  const hasService = !!form.serviceId

  return (
    <div className="space-y-3.5">

      {/* ── اختر العملية (always first) ── */}
      <div>
        <label className={labelCls}>اختر العملية</label>
        <select value={form.serviceId} onChange={(e) => onChange('serviceId', e.target.value)}
          className={inputCls}>
          <option value="">— اختر الخدمة —</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* ── Fields appear after service is chosen ── */}
      {hasService && (
        <>
          <div className="h-px bg-gray-200" />

          {/* ══ نقل داخلي ══ */}
          {!isIqama && (
            <>
              {/* صف 1: اسم العميل | رقم الهاتف | رقم الإقامة */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>اسم العميل</label>
                  <input type="text" value={form.name} onChange={(e) => onChange('name', e.target.value)}
                    placeholder="الاسم الكامل" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>رقم الهاتف</label>
                  <input type="tel" value={form.phone} onChange={(e) => onChange('phone', e.target.value)}
                    placeholder="05xxxxxxxx" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>رقم الإقامة</label>
                  <input type="text" value={form.iqamaNumber} onChange={(e) => onChange('iqamaNumber', e.target.value)}
                    placeholder="رقم الإقامة" className={inputCls} />
                </div>
              </div>

              {/* صف 2: تاريخ انتهاء الإقامة | المؤسسة | كرت العمل */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>تاريخ انتهاء الإقامة</label>
                  <input type="date" value={form.iqamaEndDate} onChange={(e) => onChange('iqamaEndDate', e.target.value)}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>المؤسسة</label>
                  <select value={form.organizationId} onChange={(e) => onChange('organizationId', e.target.value)}
                    className={inputCls}>
                    <option value="">— اختر المؤسسة —</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>كرت العمل</label>
                  <select value={form.cardType} onChange={(e) => onChange('cardType', e.target.value)}
                    className={inputCls}>
                    {CARD_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* صف 3+4: يتغير حسب طريقة الدفع */}
              {form.paymentType === 'سنوي' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>طريقة الدفع</label>
                      <select value={form.paymentType} onChange={(e) => onChange('paymentType', e.target.value)}
                        className={inputCls}>
                        <option value="">— اختر —</option>
                        <option value="شهري">شهري</option>
                        <option value="سنوي">سنوي</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>المبلغ (ر.س)</label>
                      <input type="number" min={0} value={form.amount} onChange={(e) => onChange('amount', e.target.value)}
                        placeholder="0.00" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>المبلغ المستلم (ر.س)</label>
                      <input type="number" min={0} value={form.receivedAmount} onChange={(e) => onChange('receivedAmount', e.target.value)}
                        placeholder="0.00" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>ملاحظات عن الدفعية</label>
                      <input type="text" value={form.notes} onChange={(e) => onChange('notes', e.target.value)}
                        placeholder="ملاحظات..." className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>تاريخ الدفعة القادمة (المخصص)</label>
                      <input type="date" value={form.nextPaymentDate} onChange={(e) => onChange('nextPaymentDate', e.target.value)}
                        className={inputCls} />
                    </div>
                  </div>
                </>
              ) : form.paymentType === 'شهري' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>طريقة الدفع</label>
                      <select value={form.paymentType} onChange={(e) => onChange('paymentType', e.target.value)}
                        className={inputCls}>
                        <option value="">— اختر —</option>
                        <option value="شهري">شهري</option>
                        <option value="سنوي">سنوي</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>القسط الشهري (ر.س)</label>
                      <input type="number" min={0} value={form.amount} onChange={(e) => onChange('amount', e.target.value)}
                        placeholder="0.00" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>يوم الاستلام من كل شهر</label>
                      <input type="number" min={1} max={31} value={form.boardNumber} onChange={(e) => onChange('boardNumber', e.target.value)}
                        placeholder="1 - 31" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>تاريخ الدفعة القادمة (المخصص)</label>
                      <input type="date" value={form.nextPaymentDate} onChange={(e) => onChange('nextPaymentDate', e.target.value)}
                        className={inputCls} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>طريقة الدفع</label>
                    <select value={form.paymentType} onChange={(e) => onChange('paymentType', e.target.value)}
                      className={inputCls}>
                      <option value="">— اختر —</option>
                      <option value="شهري">شهري</option>
                      <option value="سنوي">سنوي</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══ إصدار إقامة جديدة ══ */}
          {isIqama && (
            <>
              {/* صف 1: اسم العميل | رقم الهاتف | رقم الجواز */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>اسم العميل</label>
                  <input type="text" value={form.name} onChange={(e) => onChange('name', e.target.value)}
                    placeholder="الاسم الكامل" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>رقم الهاتف</label>
                  <input type="tel" value={form.phone} onChange={(e) => onChange('phone', e.target.value)}
                    placeholder="05xxxxxxxx" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>رقم الجواز</label>
                  <input type="text" value={form.passport} onChange={(e) => onChange('passport', e.target.value)}
                    placeholder="رقم الجواز" className={inputCls} />
                </div>
              </div>

              {/* صف 2: رقم الحدود | رقم التأشيرة | المؤسسة */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <div>
                  <label className={labelCls}>المؤسسة</label>
                  <select value={form.organizationId} onChange={(e) => onChange('organizationId', e.target.value)}
                    className={inputCls}>
                    <option value="">— اختر المؤسسة —</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* صف 3: كرت العمل | طريقة الدفع | المبلغ */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>كرت العمل</label>
                  <select value={form.cardType} onChange={(e) => onChange('cardType', e.target.value)}
                    className={inputCls}>
                    {CARD_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>طريقة الدفع</label>
                  <input type="text" value="سنوي" readOnly
                    className={inputCls + ' bg-gray-100 text-gray-400 cursor-not-allowed'} />
                </div>
                <div>
                  <label className={labelCls}>المبلغ (ر.س)</label>
                  <input type="number" min={0} value={form.amount} onChange={(e) => onChange('amount', e.target.value)}
                    placeholder="0.00" className={inputCls} />
                </div>
              </div>

              {/* صف 4: ملاحظات | تاريخ الدفعة القادمة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>ملاحظات عن الدفعية</label>
                  <input type="text" value={form.notes} onChange={(e) => onChange('notes', e.target.value)}
                    placeholder="ملاحظات..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>تاريخ الدفعة القادمة (المخصص)</label>
                  <input type="date" value={form.nextPaymentDate} onChange={(e) => onChange('nextPaymentDate', e.target.value)}
                    className={inputCls} />
                </div>
              </div>

              {/* ── جدول الخطوات ── */}
              <div className="pt-1">
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">الخطوات</h3>
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-sky-600 text-white text-right">
                          <th className="px-3 py-2.5 text-xs font-semibold">الخطوة</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-center">رقم الخطوة</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-center">انجزت</th>
                          <th className="px-3 py-2.5 text-xs font-semibold">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviceSteps.map((step) => {
                          const entry = stepEntries.find((e) => e.stepId === step.id)
                          return (
                            <tr key={step.id} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2.5 font-medium text-gray-800">{step.name}</td>
                              <td className="px-3 py-2.5 text-gray-500 text-center">{step.number ?? step.order}</td>
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={entry?.done ?? false}
                                  onChange={(e) => onStepChange?.(step.id, 'done', e.target.checked)}
                                  className="w-4 h-4 accent-sky-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-2.5">
                                <input
                                  type="date"
                                  value={entry?.date ?? ''}
                                  onChange={(e) => onStepChange?.(step.id, 'date', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-2 py-1.5 text-xs
                                             focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
