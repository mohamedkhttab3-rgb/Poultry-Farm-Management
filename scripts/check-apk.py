import os,sys,zipfile
p=sys.argv[1]
if not os.path.isfile(p) or os.path.getsize(p)<1000000: raise SystemExit('APK missing or too small')
with zipfile.ZipFile(p) as z:
    names=z.namelist()
    for item in ('AndroidManifest.xml','classes.dex'):
        if item not in names: raise SystemExit('Missing APK entry: '+item)
    if z.testzip(): raise SystemExit('Corrupt APK ZIP')
print('PASS: Valid nonempty Android APK archive with manifest and bytecode')
