# مراجعة تسجيل الدخول — V3.6.7 + Finance/Standards

- تم الإبقاء على مسار Supabase الأصلي في V3.6.7: `createClient` مع `persistSession`, `autoRefreshToken`, و`detectSessionInUrl`.
- تم إصلاح خطر تعارض إعدادات Supabase بين ملف الإعداد والتخزين المحلي: الإعداد الحقيقي صالح فقط إذا كان Project URL + Publishable/Anon Key حقيقيين، ولا يتم قبول قيم `YOUR_*`.
- تم دعم مفاتيح التخزين القديمة `pfm_supabase_config_v36` و`pfm_supabase_config_v1` فقط عندما تكون القيم صالحة.
- تم تحسين رسالة خطأ تسجيل الدخول لتعرض رسالة Supabase الفعلية بدل إخفائها خلف رسالة كلمة مرور عامة.
- لم يتم إدخال Service Role/Secret Key.
- تمت إضافة `getCycleCurrency` المفقودة من تعديل المصروفات؛ كانت مراجعها موجودة في عدة مواضع ويمكن أن توقف `renderAll()` بعد نجاح تسجيل الدخول.
- تم فحص JavaScript syntax وZIP.

> ملاحظة: ملف `supabase-config.example.js` المرفق مع هذه الحزمة هو مثال فقط ويحتوي على `YOUR_PROJECT` و`YOUR_SUPABASE...`. لا يمكن استخدامه للاتصال بمشروع Supabase حقيقي قبل استبدال القيم الحقيقية.
