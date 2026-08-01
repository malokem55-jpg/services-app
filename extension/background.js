// خلفية الإضافة: تفتح تاب صفحة الدخول وتحتفظ بالبيانات مؤقتًا مربوطة برقم التاب.
// التخزين في storage.session فقط (ذاكرة الجلسة — يُمسح عند إغلاق المتصفح ولا يُكتب للقرص)،
// ويُحذف فور استخدام البيانات في التعبئة.
//
// سكربت التعبئة لا يُحقن عبر content_scripts بقائمة نطاقات ثابتة، بل تحقنه الخلفية
// في التاب الذي فتحته هي فقط — بهذا تعمل التعبئة مع أي رابط دخول يضبطه المستخدم
// من النظام (غرف تجارية جديدة مثلاً) دون تعديل الإضافة، ولا يُحقن في أي تاب آخر.

// يفتح صفحة الدخول في نافذة متصفح عادية دائمًا — الطلب قد يأتي من النسخة المثبتة
// (PWA) ونافذتها ليست متصفحًا عاديًا، فلا نفتح التاب فيها أبدًا
async function openLoginTab(url) {
  try {
    const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
    if (win?.id != null) {
      const tab = await chrome.tabs.create({ windowId: win.id, url, active: true });
      await chrome.windows.update(win.id, { focused: true });
      return tab.id;
    }
  } catch {
    // لا توجد نافذة متصفح عادية مفتوحة
  }
  const newWin = await chrome.windows.create({ url, type: 'normal', focused: true });
  return newWin.tabs?.[0]?.id ?? null;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'OPEN_AND_FILL') {
    openLoginTab(msg.url).then((tabId) => {
      if (tabId == null) return;
      chrome.storage.session.set({
        ['creds_' + tabId]: { username: msg.username, password: msg.password },
      });
    });
    return;
  }

  if (msg?.type === 'GET_CREDS') {
    const tabId = sender.tab?.id;
    if (tabId == null) {
      sendResponse(null);
      return;
    }
    const key = 'creds_' + tabId;
    chrome.storage.session.get(key).then((obj) => sendResponse(obj[key] ?? null));
    return true; // الرد غير متزامن
  }

  if (msg?.type === 'CREDS_USED') {
    const tabId = sender.tab?.id;
    if (tabId != null) chrome.storage.session.remove('creds_' + tabId);
  }
});

// حقن سكربت التعبئة في تاب الدخول بعد اكتمال التحميل — فقط ما دامت بيانات هذا التاب
// موجودة (تُحذف فور التعبئة)، وفي كل الإطارات لأن بعض الفورمات داخل iframe.
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'complete') return;
  const key = 'creds_' + tabId;
  const stored = await chrome.storage.session.get(key);
  if (!stored[key]) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content-fill.js'],
    });
  } catch {
    // صفحة لا يُسمح بالحقن فيها (متجر الإضافات مثلاً)
  }
});

// تنظيف احتياطي: إغلاق التاب قبل التعبئة يمسح بياناته
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove('creds_' + tabId);
});
