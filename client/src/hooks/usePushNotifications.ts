import { useEffect } from 'react';
import { apiFetch } from '../lib/api';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

// نتيجة محاولة الاشتراك — تُمكّن الواجهة من عرض حالة واضحة للمستخدم بدل ابتلاع الأخطاء بصمت.
export type PushResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'no-vapid' | 'error'; message?: string };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function encodeKey(sub: PushSubscription, name: 'p256dh' | 'auth'): string {
  return btoa(String.fromCharCode(...new Uint8Array(sub.getKey(name)!)));
}

async function postSubscription(sub: PushSubscription): Promise<void> {
  await apiFetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: encodeKey(sub, 'p256dh'), auth: encodeKey(sub, 'auth') },
    }),
  });
}

// إلغاء الاشتراك الحالي محلياً وحذفه من الخادم. يُستخدم عند «تحديث» الاشتراك لاستبدال
// اشتراك قديم/ميّت باشتراك جديد حيّ — شائع على آيفون بعد إعادة تثبيت التطبيق، حيث يبقى
// اشتراك قديم يقبله خادم آبل (201) لكنه لا يصل الجهاز فعلياً.
async function dropExisting(registration: ServiceWorkerRegistration): Promise<void> {
  const existing = await registration.pushManager.getSubscription();
  if (!existing) return;
  const endpoint = existing.endpoint;
  try {
    await existing.unsubscribe();
  } catch {
    // فشل الإلغاء المحلي غير حرِج — نكمل لإنشاء اشتراك جديد
  }
  try {
    await apiFetch('/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) });
  } catch {
    // حذف الاشتراك القديم من الخادم غير حرِج
  }
}

// تسجيل الجهاز لاستقبال الإشعارات. تُستدعى إمّا من ضغطة المستخدم (زر «تفعيل الإشعارات»)،
// أو تلقائياً عند التحميل. مهم لآيفون: طلب الإذن (Notification.requestPermission) لا ينجح
// على iOS إلا داخل إيماءة مستخدم مباشرة — لذلك المسار التلقائي وحده لا يكفي لآيفون، ويجب
// أن يضغط المستخدم الزر. force=true يستبدل الاشتراك الحالي باشتراك جديد لإصلاح اشتراك ميّت.
export async function subscribeToPush(force = false): Promise<PushResult> {
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return { ok: false, reason: 'unsupported' };
  }
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-vapid' };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const registration = await navigator.serviceWorker.ready;

    if (force) await dropExisting(registration);

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
    }

    await postSubscription(subscription);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

export function usePushNotifications() {
  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    // محاولة تلقائية غير قسرية: تكفي للأجهزة التي سبق أن منحت الإذن (أندرويد عادةً).
    // آيفون يحتاج الزر اليدوي في الإعدادات لأن طلب الإذن يتطلّب إيماءة مستخدم.
    subscribeToPush(false).catch(() => {});
  }, []);
}
