// أدوات التعبئة المشتركة (مكتوبة ذاتية الاحتواء لتعمل داخل صفحة مقيم عبر Bookmarklet):
//   S(i,v) — يحقن قيمة في حقل ويُطلق أحداث input/change/blur كأن المستخدم كتبها.
//   V(e)   — يتأكد أن العنصر ظاهر فعلاً (له أبعاد على الشاشة).
//   F()    — يجد حقل كلمة المرور المرئي وأقرب حقل نصي يسبقه (اسم المستخدم)،
//            ويُرجع {p,u} أو null إن لم تظهر خانة كلمة مرور بعد.
const FILL_HELPERS =
  `function S(i,v){var d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(i),'value')||Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d.set.call(i,v);i.dispatchEvent(new Event('input',{bubbles:!0}));i.dispatchEvent(new Event('change',{bubbles:!0}));i.dispatchEvent(new Event('blur',{bubbles:!0}))}` +
  `function V(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0}` +
  `function F(){` +
  `var p=[].filter.call(document.querySelectorAll('input[type=password]'),V)[0];if(!p)return null;` +
  `var a=[].filter.call(document.querySelectorAll('input[type=text],input[type=email],input:not([type])'),V);` +
  `var f=p.closest('form');var s=f?a.filter(function(c){return f.contains(c)}):a;var l=s.length?s:a;` +
  `var u=null;l.forEach(function(c){if(p.compareDocumentPosition(c)&Node.DOCUMENT_POSITION_PRECEDING)u=c});` +
  `return{p:p,u:u}}`

// تنبيه يظهر إذا انتهت المهلة (45 ثانية) دون أن تظهر خانة دخول في الصفحة.
const NO_LOGIN_ALERT = `alert('لم أجد صفحة الدخول \\u2014 تأكد أنك على صفحة تسجيل دخول مقيم')`

export interface FillOrg {
  name: string | null
  username: string
  password: string
}

/**
 * الزر الموحّد — الحل المعتمد لمقيم. يحمل بيانات **كل المؤسسات** بداخله، فلا يتصل بأي
 * خادم. وهذا ضروري لأن مقيم يفرض Content-Security-Policy بـ `connect-src 'self'` يحجب
 * أي fetch من صفحته لخوادم خارجية — فأي زر يعتمد على الجلب يفشل حتمًا. يُحفظ في مفضلة
 * Safari مرة واحدة، وعند ضغطه على صفحة الدخول يعرض قائمة بحث: تكتب اسم المؤسسة فتُصفّى،
 * وباختيارها تنتظر ظهور خانة الدخول (حتى 45 ثانية) ثم تعبّي مباشرة.
 */
export function buildUnifiedFillBookmarklet(orgs: FillOrg[]): string {
  const data = JSON.stringify(
    orgs.map((o) => ({ n: o.name ?? '—', u: o.username, p: o.password })),
  )
  const src =
    `(function(){` +
    `var O=${data};var D=Date.now()+45000;` +
    FILL_HELPERS +
    // تطبيع عربي للبحث: يتجاهل التشكيل ويوحّد أ‑إ‑آ→ا، ى→ي، ة→ه
    `function N(s){return(s||'').replace(/[\\u064B-\\u0652]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\\u0640/g,'').toLowerCase().trim()}` +
    // اختيار مؤسسة: يطلب تأكيدًا باسم المؤسسة قبل التعبئة (إلغاء = تبقى القائمة لإعادة الاختيار)،
    // ثم يُزيل القائمة وينتظر خانة الدخول ويعبّي
    `function pick(o){if(!confirm('تعبئة بيانات: '+o.n+' ؟'))return;box.remove();var t=setInterval(function(){var g=F();if(g){clearInterval(t);if(g.u)S(g.u,o.u);S(g.p,o.p)}else if(Date.now()>D){clearInterval(t);${NO_LOGIN_ALERT}}},400)}` +
    // بناء قائمة البحث فوق الصفحة (أنماط سطرية — مسموحة بـ style-src 'unsafe-inline')
    `var box=document.createElement('div');box.setAttribute('style','position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;padding:40px 12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif');` +
    `var card=document.createElement('div');card.setAttribute('style','background:#fff;border-radius:16px;width:100%;max-width:420px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.3)');` +
    `var inp=document.createElement('input');inp.setAttribute('placeholder','ابحث باسم المؤسسة...');inp.setAttribute('style','border:0;border-bottom:1px solid #eee;padding:16px;font-size:16px;outline:none;direction:rtl;text-align:right');` +
    `var list=document.createElement('div');list.setAttribute('style','overflow-y:auto;-webkit-overflow-scrolling:touch');` +
    `function render(q){list.innerHTML='';var nq=N(q),n=0;O.forEach(function(o){if(nq&&N(o.n).indexOf(nq)<0)return;if(++n>300)return;var b=document.createElement('button');b.textContent=o.n;b.setAttribute('style','display:block;width:100%;text-align:right;direction:rtl;padding:14px 16px;border:0;border-bottom:1px solid #f4f4f4;background:#fff;font-size:15px;color:#1f2937');b.onclick=function(){pick(o)};list.appendChild(b)});if(!list.children.length){var e=document.createElement('div');e.textContent='لا توجد نتائج';e.setAttribute('style','padding:18px;text-align:center;color:#9ca3af;font-size:14px');list.appendChild(e)}}` +
    `inp.addEventListener('input',function(){render(inp.value)});box.addEventListener('click',function(e){if(e.target===box)box.remove()});` +
    `card.appendChild(inp);card.appendChild(list);box.appendChild(card);document.body.appendChild(box);render('');try{inp.focus()}catch(e){}` +
    `})()`
  return 'javascript:' + encodeURIComponent(src)
}
