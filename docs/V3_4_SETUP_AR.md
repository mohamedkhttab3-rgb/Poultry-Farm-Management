# إعداد V3.4 Cloud Sync + Supabase

## 1) إنشاء مشروع Supabase

من حسابك في Supabase أنشئ Project جديد باسم مثل:

`poultry-farm-manager`

بعد إنشاء المشروع ستحتاج فقط إلى:

- Project URL
- Publishable Key / Anon Key

لا تضع Secret Key / Service Role Key داخل التطبيق.

## 2) تشغيل قاعدة البيانات

افتح **SQL Editor** في مشروع Supabase وشغّل بالترتيب:

1. `backend/v3_3_rls.sql`
2. `backend/v3_4_cloud.sql`

ملف V3.4 يضيف:
- company_name
- license_number
- inventory_items
- updated_at
- sync_tombstones
- سياسات RLS منفصلة للقراءة/الإضافة/التعديل/الحذف
- صلاحيات Owner / Manager / Supervisor / Worker

## 3) تفعيل البريد وكلمة المرور

في Supabase Authentication فعّل Email provider.

إذا كان Confirm Email مفعّلًا، يجب على المستخدم تأكيد بريده قبل تسجيل الدخول.

## 4) Redirect URLs

أضف عنوان التطبيق المنشور في Authentication > URL Configuration.

للتطوير المحلي يمكن إضافة عنوان localhost المستخدم أثناء التشغيل.

لإعادة كلمة المرور، يجب أن يكون رابط إعادة التوجيه موجودًا ضمن Redirect URLs المسموح بها.

## 5) ربط التطبيق

انسخ:

`www/supabase-config.example.js`

إلى:

`www/supabase-config.js`

ثم ضع:

- url = Project URL
- publishableKey = Publishable/Anon Key
- redirectTo = عنوان التطبيق الذي سيعود إليه المستخدم بعد استعادة كلمة المرور

مثال:

```js
window.PFM_SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT.supabase.co',
  publishableKey: 'YOUR_PUBLISHABLE_OR_ANON_KEY',
  redirectTo: 'https://YOUR_APP_DOMAIN/reset-password'
};
```

## 6) طريقة عمل V3.4

- المستخدم يسجل الدخول عبر Supabase Auth.
- بياناته المحلية تحفظ في Local Storage منفصل حسب user ID.
- التطبيق يعمل بدون إنترنت.
- عند وجود اتصال يتم رفع البيانات إلى Supabase.
- عند عودة الإنترنت يتم إعادة المحاولة تلقائيًا.
- عند فتح التطبيق من جهاز آخر يتم سحب بيانات المزارع التي يسمح بها RLS.
- صلاحيات قاعدة البيانات لا تعتمد على إخفاء الأزرار فقط؛ RLS هو الحاجز الحقيقي.

## 7) استعادة كلمة المرور

من شاشة الدخول:

**استعادة كلمة المرور → البريد الإلكتروني → رابط البريد → كلمة مرور جديدة**.

## 8) الاختبار قبل النشر

اختبر أربعة حسابات/أدوار:

1. Owner
2. Manager
3. Supervisor
4. Worker

واختبر مستخدمًا لا ينتمي إلى مزرعة للتأكد أنه لا يستطيع قراءة بياناتها.

اختبر أيضًا:

- إضافة مزرعة
- اسم الشركة ورقم الترخيص
- إضافة عنبر
- إنشاء دورة
- متابعة يومية
- الأوزان
- الأعلاف
- الأدوية
- المبيعات
- التكاليف والأرباح
- حذف سجل
- انقطاع الإنترنت ثم عودته
- الدخول من جهاز ثانٍ
- استعادة كلمة المرور

## ملاحظة مهمة

إنشاء مشروع Supabase داخل حساب المستخدم نفسه يتطلب تسجيل الدخول إلى حساب Supabase الخاص بالمستخدم، لذلك لا يتم وضع بيانات الحساب أو المفاتيح السرية داخل المشروع. التطبيق يستخدم فقط Project URL + Publishable/Anon Key في جهة العميل.
