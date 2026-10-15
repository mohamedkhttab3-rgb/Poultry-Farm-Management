# Poultry Farm Manager V3.2.2

## الهدف
نقل تسجيل الدخول من النظام المحلي التجريبي إلى Supabase Auth الحقيقي.

## ما تم في هذه النسخة
- إصلاح زر تسجيل الدخول وإنشاء الحساب.
- التحقق من البريد وكلمة المرور.
- جلسة دخول محفوظة.
- دعم Supabase Auth عند توفر SUPABASE_URL + Publishable/Anon Key.
- استمرار Local Demo عند عدم إعداد Supabase.
- ملفات SQL مبدئية لـ profiles وRLS وtrigger إنشاء الملف الشخصي.
- عدم وضع Service Role Key داخل التطبيق.

## إعداد Supabase
1. أنشئ مشروعًا في Supabase.
2. من Authentication فعّل Email provider.
3. شغّل `backend/supabase_auth.sql` داخل SQL Editor.
4. أنشئ `www/supabase-config.js` من `supabase-config.example.js`.
5. ضع Project URL وPublishable/Anon Key فقط.
6. جرّب إنشاء حساب ثم تسجيل الدخول.

## قبل الإطلاق العام
- تفعيل RLS على كل الجداول.
- إنشاء farm_members للصلاحيات المشتركة.
- ربط كل Farm/User بعلاقة واضحة.
- Password reset.
- Email verification حسب سياسة المنتج.
- حذف/تصدير حساب المستخدم وفق متطلبات الخصوصية.
- Audit log.
- حماية البيانات الحساسة.
