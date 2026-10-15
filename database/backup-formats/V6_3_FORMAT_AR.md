# تنسيق النسخة الكاملة V6.3

```json
{
  "format": "PFM_BACKUP_V63",
  "schemaVersion": 1,
  "exportedAt": "2026-10-13T00:00:00.000Z",
  "storage": "localStorage + IndexedDB snapshots (per-user)",
  "recordCounts": {"farms": 0, "houses": 0, "cycles": 0, "daily": 0, "weights": 0, "feed": 0, "meds": 0, "inventory": 0, "sales": 0},
  "checksum": null,
  "data": {"farms": [], "houses": [], "cycles": [], "daily": [], "weights": [], "feed": [], "meds": [], "inventory": [], "finance": {}, "sales": [], "tombstones": [], "auditLog": [], "invitations": [], "performanceRules": [], "settings": {"currency": "SAR", "language": "ar", "globalStandardBreed": "Ross 308"}}
}
```

هذا مثال **فارغ** للهيكل، وليس نسخة احتياطية من متصفح المستخدم. النسخة الحقيقية المحفوظة من البرنامج تحسب عادة `checksum` كبصمة SHA-256 لسلسلة `JSON.stringify(data)` عندما يكون WebCrypto متاحًا، ويجب أن تبقى الحقول والمعرفات صحيحة.
