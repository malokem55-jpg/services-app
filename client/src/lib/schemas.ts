import { z } from 'zod'

// ── Login ────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
})

// ── Client ───────────────────────────────────────────────────────────────────
// isIqama = true  → service has steps (iqama-issuing mode)
// isIqama = false → non-iqama service (internal transfer)
// isAdd = true    → add form: stricter rules (iqamaNumber + iqamaEndDate required;
//                             receivedAmount required when paymentType === 'سنوي';
//                             boardNumber required when paymentType === 'شهري')
// isAdd = false   → edit form: keep original conditional iqamaEndDate rule
export function clientSchema(isIqama: boolean, isAdd = false) {
  const base = z.object({
    name:           z.string().min(1, 'اسم العميل مطلوب'),
    phone:          z.string().min(1, 'رقم الهاتف مطلوب'),
    serviceId:      z.string().min(1, 'الخدمة مطلوبة'),
    organizationId: z.string().min(1, 'المؤسسة مطلوبة'),
    cardType:       z.string().min(1, 'نوع البطاقة مطلوب'),
    paymentType:    z.string().min(1, 'طريقة الدفع مطلوبة'),
    amount:         z.string().min(1, 'المبلغ مطلوب'),
    iqamaNumber:    z.string().optional(),
    iqamaEndDate:   z.string().optional(),
  })

  if (isIqama) {
    return base.extend({
      receivedAmount: z.string().min(1, 'المبلغ المستلم مطلوب'),
    }) as z.ZodTypeAny
  }

  // Edit form (isAdd = false): require iqamaEndDate only when iqamaNumber is entered
  //                            require boardNumber when paymentType is 'شهري'
  if (!isAdd) {
    return base
      .extend({ boardNumber: z.string().optional() })
      .superRefine((d, ctx) => {
        if (d.iqamaNumber && !d.iqamaEndDate) {
          ctx.addIssue({ code: 'custom', message: 'تاريخ انتهاء الإقامة مطلوب عند إدخال رقم الإقامة', path: ['iqamaEndDate'] })
        }
        if (d.paymentType === 'شهري' && !d.boardNumber) {
          ctx.addIssue({ code: 'custom', message: 'يوم الاستلام مطلوب', path: ['boardNumber'] })
        }
      }) as z.ZodTypeAny
  }

  // Add form (isAdd = true, non-iqama):
  //   • iqamaNumber + iqamaEndDate always required
  //   • receivedAmount required when paymentType === 'سنوي'
  //   • boardNumber required when paymentType === 'شهري'
  return base
    .extend({
      iqamaNumber:    z.string().min(1, 'رقم الإقامة مطلوب'),
      iqamaEndDate:   z.string().min(1, 'تاريخ انتهاء الإقامة مطلوب'),
      receivedAmount: z.string().optional(),
      boardNumber:    z.string().optional(),
    })
    .superRefine((d, ctx) => {
      if (d.paymentType === 'سنوي' && !d.receivedAmount) {
        ctx.addIssue({ code: 'custom', message: 'المبلغ المستلم مطلوب', path: ['receivedAmount'] })
      }
      if (d.paymentType === 'شهري' && !d.boardNumber) {
        ctx.addIssue({ code: 'custom', message: 'يوم الاستلام مطلوب', path: ['boardNumber'] })
      }
    }) as z.ZodTypeAny
}

// ── Service Step ─────────────────────────────────────────────────────────────
export const serviceStepSchema = z.object({
  name:   z.string().min(1, 'اسم الخطوة مطلوب'),
  number: z.string()
    .min(1, 'الرقم مطلوب')
    .regex(/^\d+$/, 'يجب أن يكون الرقم أرقاماً فقط'),
})

// ── Organization ─────────────────────────────────────────────────────────────
export const organizationSchema = z.object({
  name:        z.string().min(1, 'اسم المؤسسة مطلوب'),
  number:      z.string().min(1, 'رقم السجل مطلوب'),
  expiredDate: z.string().min(1, 'تاريخ انتهاء السجل مطلوب'),
})

// ── Client Step ──────────────────────────────────────────────────────────────
export const clientStepSchema = z.object({
  stepId:   z.string().min(1, 'الخطوة مطلوبة'),
  stepDate: z.string().min(1, 'التاريخ مطلوب'),
})

// ── Client Payment ───────────────────────────────────────────────────────────
export const clientPaymentSchema = z.object({
  amount:          z.string().min(1, 'المبلغ مطلوب'),
  nextPaymentDate: z.string().min(1, 'تاريخ الدفعة القادمة مطلوب'),
})

// ── Validation helper ────────────────────────────────────────────────────────
/**
 * Run a Zod schema and return a flat Record<fieldName, firstErrorMessage>.
 * Returns {} on success.
 */
export function getErrors(schema: z.ZodTypeAny, data: unknown): Record<string, string> {
  const result = schema.safeParse(data)
  if (result.success) return {}
  const out: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
