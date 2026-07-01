import 'dotenv/config';
import jwt from 'jsonwebtoken';
// أداة اختبار محلية: تُوقّع رمز دخول لأول مستخدم لاختبار المسارات المحمية.
console.log(jwt.sign({ userId: 1 }, process.env.JWT_SECRET as string, { expiresIn: '1h' }));
