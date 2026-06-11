// يعمل داخل صفحة تسجيل دخول المنصة (مقيم):
// يطلب البيانات المؤقتة من الخلفية، ينتظر ظهور فورم الدخول (الصفحة SPA)،
// يملأ خانتي اسم المستخدم وكلمة المرور ثم يتوقف — الضغط على زر الدخول مسؤولية المستخدم.

(async () => {
  const creds = await chrome.runtime.sendMessage({ type: 'GET_CREDS' }).catch(() => null);
  if (!creds || !creds.username) return;

  const DEADLINE = Date.now() + 25000; // مهلة انتظار ظهور الفورم

  // فورمات React/Angular تتجاهل تعيين value المباشر — نستخدم الـ setter الأصلي ونطلق أحداثًا حقيقية
  function setNativeValue(input, value) {
    const desc =
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value') ||
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    desc.set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function findFields() {
    const pw = [...document.querySelectorAll('input[type="password"]')].find(isVisible);
    if (!pw) return null;

    // خانة اسم المستخدم: أقرب حقل نصي مرئي يسبق حقل كلمة المرور (داخل نفس الفورم إن وُجد)
    const all = [...document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])')]
      .filter(isVisible);
    const form = pw.closest('form');
    const scoped = form ? all.filter((c) => form.contains(c)) : all;
    const pool = scoped.length ? scoped : all;

    let user = null;
    for (const c of pool) {
      if (pw.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_PRECEDING) user = c;
    }
    return { user, pw };
  }

  function tryFill() {
    const fields = findFields();
    if (!fields) return false;
    if (fields.user) setNativeValue(fields.user, creds.username);
    setNativeValue(fields.pw, creds.password);
    return true;
  }

  const timer = setInterval(() => {
    if (tryFill() || Date.now() > DEADLINE) {
      clearInterval(timer);
      chrome.runtime.sendMessage({ type: 'CREDS_USED' }).catch(() => {});
    }
  }, 400);
})();
