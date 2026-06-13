// مولّد «الزر السحري»: Bookmarklet يُحفظ في مفضلة Safari على الآيفون مرة واحدة.
// عند ضغطه داخل صفحة دخول مقيم ينتظر ظهور خانة كلمة المرور (حتى 45 ثانية)، ثم
// يجلب البيانات المسلّحة من السيرفر لحظتها فقط ويعبّي الحقول. تأجيل الجلب حتى وجود
// الخانة يمنع استهلاك التسليح (لمرة واحدة) في محاولة تفشل لأن الصفحة لم تكتمل بعد.
// وإذا انتهت المهلة دون عثور على الخانة يُنبّه المستخدم بدل التوقف الصامت.
// نفس منطق التعبئة في إضافة Chrome (extension/content-fill.js) مكتوباً ذاتي الاحتواء.
export function buildFillBookmarklet(apiBase: string, fillKey: string): string {
  const src =
    `(function(){` +
    `var D=Date.now()+45000;` +
    `function S(i,v){var d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(i),'value')||Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d.set.call(i,v);i.dispatchEvent(new Event('input',{bubbles:!0}));i.dispatchEvent(new Event('change',{bubbles:!0}));i.dispatchEvent(new Event('blur',{bubbles:!0}))}` +
    `function V(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0}` +
    `function F(){` +
    `var p=[].filter.call(document.querySelectorAll('input[type=password]'),V)[0];if(!p)return null;` +
    `var a=[].filter.call(document.querySelectorAll('input[type=text],input[type=email],input:not([type])'),V);` +
    `var f=p.closest('form');var s=f?a.filter(function(c){return f.contains(c)}):a;var l=s.length?s:a;` +
    `var u=null;l.forEach(function(c){if(p.compareDocumentPosition(c)&Node.DOCUMENT_POSITION_PRECEDING)u=c});` +
    `return{p:p,u:u}}` +
    `var t=setInterval(function(){` +
    `var g=F();` +
    `if(g){clearInterval(t);` +
    `fetch('${apiBase}/api/mobile-fill/pending?key=${fillKey}')` +
    `.then(function(r){if(!r.ok)throw 0;return r.json()})` +
    `.then(function(c){if(g.u)S(g.u,c.username);S(g.p,c.password)})` +
    `.catch(function(){alert('لا توجد بيانات دخول جاهزة \\u2014 افتح المنصة من التطبيق أولاً')})}` +
    `else if(Date.now()>D){clearInterval(t);alert('لم أجد صفحة الدخول \\u2014 تأكد أنك على صفحة تسجيل دخول مقيم')}` +
    `},400)` +
    `})()`
  return 'javascript:' + encodeURIComponent(src)
}
