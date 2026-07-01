import fs from 'node:fs';
// أداة اختبار محلية: تعرض عدد بيانات الدخول المفكوكة بإخفاء كلمات المرور.
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (Array.isArray(data)) {
  const ok = data.filter((x: Record<string, unknown>) => x.username && x.password).length;
  console.log(`items: ${data.length}, decrypted (username+password present): ${ok}`);
  const s = data[0] as Record<string, unknown> | undefined;
  if (s) {
    console.log(
      `sample: user=${String(s.username).slice(0, 3)}*** passLen=${s.password ? String(s.password).length : 0}`,
    );
  }
} else {
  console.log('response:', JSON.stringify(data).slice(0, 300));
}
