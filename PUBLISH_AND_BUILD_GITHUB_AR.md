# ارفع V6.6 إلى GitHub خاص وابنِ EXE وAPK

تم بالفعل توصيل GitHub بحسابك في ChatGPT، لكن لا يوجد مستودع ظاهر بعد. يجب أولاً إنشاء مستودع جديد عبر **github.com/new**، باسم `Poultry-Farm-Manager` واختيار **Private**، ثم إلغاء تحديد إنشاء README و.gitignore (مستودع فارغ).

## الطريقة الأسهل على Windows
1. فك ضغط حزمة `GITHUB_AUTO_BUILD_SAFE.zip`.
2. ثبّت [Node.js 22](https://nodejs.org/) و[Git for Windows](https://git-scm.com/downloads/win).
3. افتح مجلد `PoultryFarmManager` (الذي يحتوي `package.json`) واضغط مرتين على `PUBLISH_GITHUB_PRIVATE.bat`.
4. ألصق رابط HTTPS للمستودع الخاص الذي أنشأته (مثال `https://github.com/USER/Poultry-Farm-Manager.git`).
5. اكتب PRIVATE للتأكيد. سيتم فحص الملفات ضد تسريب نسخة استعادة المزارع، ثم رفعها إلى GitHub بعد تسجيل الدخول.
6. افتح GitHub → المستودع → Actions → Windows EXE and Android APK. يبدأ العمل تلقائيًا عند نجاح رفع فرع `main`؛ قد تحتاج السماح بتشغيل Actions في إعدادات المستودع.
7. عندما تنجح الوظيفتان نزّل Artifacts `PFM-Windows-EXE-unsigned` و `PFM-Android-debug-APK`.

## مهم
- EXE وAPK **لن يظهرا** إلا بعد نجاح عملية البناء السحابي. وجود ملفات سير العمل وحده ليس بناءً.
- انتبه: EXE غير موقّع وشهادة Android تجريبية؛ النسختان للاختبار وليس لتوزيع إنتاجي.
- لا ترفع الأرشيف الخاص الذي يحتوي على سجلات استعادة المزارع. استخدم فقط الحزمة الآمنة.
- اختبر الاستعادة باستخدام JSON بعد التثبيت؛ لن تنتقل بيانات localStorage تلقائيًا بين الإصدارات والأجهزة.
- Supabase غير معتمد للإنتاج؛ يلزم اختبار RLS وتعارضات الجهازين على خادم اختباري منفصل أولًا.
