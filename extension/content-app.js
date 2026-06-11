// جسر بين صفحات نظام الخدمات وخلفية الإضافة:
// التطبيق يرسل window.postMessage بطلب فتح + تعبئة، ونحن نمرره للخلفية ونرد بإيصال (ACK)
// — بهذا لا يحتاج التطبيق معرفة معرّف الإضافة (Extension ID).

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  const msg = e.data;
  if (!msg || msg.type !== 'SA_LOGIN_FILL_REQUEST') return;
  if (typeof msg.url !== 'string' || !/^https:\/\//.test(msg.url)) return;

  chrome.runtime.sendMessage({
    type: 'OPEN_AND_FILL',
    url: msg.url,
    username: String(msg.username ?? ''),
    password: String(msg.password ?? ''),
  });

  window.postMessage({ type: 'SA_LOGIN_FILL_ACK', requestId: msg.requestId }, window.location.origin);
});
