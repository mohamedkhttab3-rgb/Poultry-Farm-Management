# Poultry Farm Management — V7.0 (Windows + Android)

هذه نسخة **مصدر جاهزة للبناء** من V6.9.3؛ وليست EXE أو APK جاهزين حاليًا. **لا تُرفع بيانات المزرعة أو ملفات JSON الشخصية إلى GitHub**.

## خطوة واحدة على Windows لرفع المصدر الآمن
1. احفظ نسخة JSON من تطبيق V6.9.3 الحالي في مجلد خاص خارج البرنامج.
2. فك ضغط الملف V7.0 في مجلد جديد، وافتح `PoultryFarmManager`.
3. ثبّت Git for Windows وNode.js 22 إذا لم يكونا موجودين.
4. اضغط مرتين على `PUBLISH_GITHUB_PRIVATE.bat`، واكتب `YES` ثم سجّل الدخول إلى GitHub عند الحاجة.
5. لا تنشئ مستودعًا جديدًا. الرفع يذهب فقط إلى المستودع الخاص:
   `https://github.com/mohamedkhttab3-rgb/Poultry-Farm-Management.git`

## تنزيل EXE وAPK بعد نجاح GitHub Actions
1. افتح `https://github.com/mohamedkhttab3-rgb/Poultry-Farm-Management/actions`.
2. اختر أحدث تشغيل بعنوان `Build Poultry Farm Management V7.0 (Windows + Android)`.
3. انتظر علامات النجاح الخضراء لوظيفتي **windows** و **android**.
4. في آخر صفحة التشغيل، نزّل **PoultryFarmManagement-V7-Windows-unsigned** و **PoultryFarmManagement-V7-Android-debug** من **Artifacts**.
5. فك ضغط ملف كل Artifact: تجد Windows Installer وPortable EXE، وفي ملف Android تجد APK تجريبيًا.
6. الملفات **غير موقعة تجاريًا**. Windows SmartScreen قد يطلب تأكيدًا، وAPK تجريبي يحتاج السماح بالتثبيت من المصدر في Android. لا تستخدمها للنشر التجاري قبل توقيعها واختبارها.

## الحفاظ على البيانات
- ملفات المتصفح القديمة لا تنتقل تلقائيًا إلى Electron أو Android؛ البيانات محلية لكل منشأ/تطبيق.
- ثبّت التطبيق ثم استورد نسخة JSON عبر **الإعدادات → إدارة البيانات والنسخ الاحتياطية → استيراد JSON**.
- لا تستبدل نسخة البيانات الوحيدة؛ تأكد من ظهور سجلات المزارع والدورات والتقارير قبل الاعتماد على التطبيق الجديد.

## تحذير للموبايل
- توليد APK ناجح لا يثبت عمل كل وظائف حفظ الملفات/PDF في Android WebView، وقد تحتاج هذه الوظائف إلى دعم أصلي إضافي؛ يلزم اختبارها على هاتف فعلي قبل استخدام بيانات إنتاج حقيقية.
- لا تفعّل مزامنة Supabase للإنتاج قبل اختبار أدوار المستخدمين وسياسات RLS وتعارض التعديلات على خادم تجريبي حقيقي.

## تواصل الدعم
لو ظهر فشل أحمر في Actions، افتح التشغيل واضغط على اسم وظيفة **windows** أو **android** وأرسل صورة الخطأ؛ يتم إصلاحه من سجل البناء بدل التخمين.
