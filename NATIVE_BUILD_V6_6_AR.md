# Poultry Farm Manager V6.6 — ملفات البناء والتثبيت

هذه **حزمة مصدر**؛ لا تحتوي على EXE أو APK مُنشأ مسبقًا. لا ترسل بيانات المزارع أو ملفات JSON الفعلية إلى GitHub عام.

## Windows — بناء محلي
1. ثبّت Node.js 22 أو أحدث على Windows واتصل بالإنترنت.
2. افتح المجلد الذي يحتوي package.json وشغّل `BUILD_WINDOWS_EXE.bat`.
3. ستجد ملفات EXE (تثبيت NSIS + نسخة portable) داخل `dist-desktop`.
4. الملفات الاختبارية غير موقعة رقميًا؛ قد يعرض Windows SmartScreen تحذيرًا. يلزم توقيع موثوق قبل توزيع إنتاجي.

## Android — APK تجريبي
1. ثبّت Node.js 22 وAndroid Studio الحديثة، وJDK 21 واضبط `ANDROID_HOME` أو `ANDROID_SDK_ROOT` وثبّت SDK API 36.
2. شغّل `BUILD_ANDROID_APK.bat`؛ سينشئ مشروع `android/` إذا لم يكن موجودًا ثم ينفذ Gradle.
3. موقع الملف الناتج `android/app/build/outputs/apk/debug/app-debug.apk` (نسخة تجريبية فقط).
4. للتثبيت استخدم هاتفًا Android واختبر تسجيل الدخول، والاستعادة، وطباعة PDF، وExcel. نسخة الإنتاج تتطلب توقيع Release وحزمة إعداد خاصة.

## عبر GitHub Actions (بدون أدوات بناء محلية)
1. أنشئ مستودعًا **خاصًا Private** وارفع محتويات مجلد المشروع (بحيث يظهر `package.json` في الجذر).
2. انتقل إلى تبويب **Actions**، واختر **Windows EXE and Android APK** ثم **Run workflow**.
3. انتظر انتهاء الوظيفتين، ثم نزّل ملفات **Artifacts**: `PFM-Windows-EXE-unsigned` و`PFM-Android-debug-APK`.
4. ظهور artifacts يتوقف على نجاح البناء على GitHub؛ وجود workflow وحده لا يثبت نجاح البناء.
5. GitHub Actions قد يطلب تفعيل الصلاحيات أو حدود استخدام بحسب الحساب.

## بيانات المستخدمين
- لا تنتقل بيانات localStorage تلقائيًا إلى EXE أو APK. صدّر JSON قبل الانتقال، ثم استخدم خيار الاستيراد الآمن.
- لا تنقل بيانات فعلية ضمن كود البرنامج أو حساب GitHub. احفظ نسخ JSON خارج المستودع.
- مجلد `database/` يحتوي مخططات SQL والملفات المرجعية؛ لا يعني قاعدة سحابية مفعّلة.

## Supabase
- لا تدخل service_role أو secret key داخل التطبيق أبدًا؛ فقط Project URL + publishable/anon key.
- المزامنة الحالية تجريبية وقد تحدث تعارضات إذا استخدم جهازان السجل نفسه. لا تفعّلها مع بيانات الإنتاج قبل اختبارات RLS والتعارض.
- انظر `SUPABASE_STAGING_CHECKLIST_AR.md` وأداة `scripts/check-supabase-rls.mjs` التي تختبر **قراءة** بيانات مزرعة عبر حسابين منفصلين.

**تحذير الخصوصية:** استخدم فقط حزمة `PUBLIC_SAFE` للرفع إلى GitHub، حتى لو كان المستودع خاصًا. لا ترفع حزمة الأرشيف الكامل التي تتضمن `www/pfm-recovery-data.js` و`database/original-recovery-from-V5.6.json`.
