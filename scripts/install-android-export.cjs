// Install stable Android export code into a generated Capacitor project.
// Never modify user data or the web app's calculations.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const javaSrc=path.join(root,'native-assets','android','PFMNativeExportPlugin.java');
const pkgDir=path.join(root,'android','app','src','main','java','com','poultryfarm','manager');
const activity=path.join(pkgDir,'MainActivity.java');
const manifest=path.join(root,'android','app','src','main','AndroidManifest.xml');
const res=path.join(root,'android','app','src','main','res','xml');
if(!fs.existsSync(javaSrc)||!fs.existsSync(activity)||!fs.existsSync(manifest))throw Error('Expected native project missing');
fs.copyFileSync(javaSrc,path.join(pkgDir,'PFMNativeExportPlugin.java'));
let main=fs.readFileSync(activity,'utf8');
if(!main.includes('registerPlugin(PFMNativeExportPlugin.class)')){
 const match='public class MainActivity extends BridgeActivity {';
 if(!main.includes(match))throw Error('MainActivity layout changed');
 main=main.replace(match,match+'\n  @Override public void onCreate(android.os.Bundle state) {\n    registerPlugin(PFMNativeExportPlugin.class);\n    super.onCreate(state);\n  }');
 fs.writeFileSync(activity,main);
}
let xml=fs.readFileSync(manifest,'utf8');
if(!xml.includes('com.poultryfarm.manager.pfmexport')){
 if(!xml.includes('</application>'))throw Error('Android manifest application not found');
 const provider='    <provider android:name="androidx.core.content.FileProvider"\n      android:authorities="com.poultryfarm.manager.pfmexport"\n      android:exported="false" android:grantUriPermissions="true">\n      <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/pfm_share_paths" />\n    </provider>\n  ';
 xml=xml.replace('</application>',provider+'</application>');
 fs.writeFileSync(manifest,xml);
}
fs.mkdirSync(res,{recursive:true});
fs.writeFileSync(path.join(res,'pfm_share_paths.xml'),
 '<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android"><cache-path name="pfm-exports" path="pfm-exports/" /></paths>\n');
if(!fs.readFileSync(activity,'utf8').includes('registerPlugin(PFMNativeExportPlugin.class)'))throw Error('Plugin not registered');
console.log('PASS: Native Android export and SAF/FileProvider bridge installed');
