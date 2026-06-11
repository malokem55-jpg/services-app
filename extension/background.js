// خلفية الإضافة: تفتح تاب صفحة الدخول وتحتفظ بالبيانات مؤقتًا مربوطة برقم التاب.
// التخزين في storage.session فقط (ذاكرة الجلسة — يُمسح عند إغلاق المتصفح ولا يُكتب للقرص)،
// ويُحذف فور استخدام البيانات في التعبئة.

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

// تنظيف احتياطي: إغلاق التاب قبل التعبئة يمسح بياناته
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove('creds_' + tabId);
});
