// Poultry Farm Management V7.1 - staged Git file privacy guard.
// Inspect ACTUAL file types, not documentation directory names.
'use strict';
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const fs=require('node:fs');
const projectRoot=path.resolve(__dirname,'..');
function problem(rawName) {
  const f=String(rawName||'').replace(/\\/g,'/').replace(/^\.\//,'');
  const n=f.toLowerCase();
  // Credentials, signing keys, device-specific platform/build folders.
  if (/(^|\/)(?:node_modules|android|ios|dist-desktop|build|\.git)(\/|$)/i.test(n))return 'generated/native build folder';
  if (/(^|\/)\.env(?:\.[^/]*)?$/i.test(n) && !/(^|\/)\.env\.example$/i.test(n))return 'environment secrets';
  if (/(^|\/)(?:google-services\.json|google-service-info\.plist|service-account(?:-[^/]*)?\.json|credentials?(?:-[^/]*)?\.json|secrets?\.json)$/i.test(n))return 'credential file';
  if (/\.(?:keystore|jks|p12|pfx|pem|key|exe|apk|aab)$/i.test(n))return 'key or compiled executable';
  if (/(^|\/)supabase-config\.(?:local|private)(?:\.[^/]*)?$/i.test(n))return 'private backend config';
  if (/^(?:database|backups)\/.*\.(?:json|csv|xlsx?|zip|sqlite3?|db|bak|dump|tar|gz)$/i.test(n) && n!=='database/empty-template.json')return 'database backup/data under protected folder';
  if (/(^|\/)(?:original[-_]?recovery|personal[-_]?data|user[-_]?data|real[-_]?farm[-_]?data)(?:[-_][^/]*)?\.(?:json|js|zip|csv|sqlite3?|db|xlsx?)$/i.test(n))return 'user data or recovery';
  if (/(^|\/)(?:backup|restore|recovery)[-_][^/]+\.(?:json|js|zip|csv|sqlite3?|db|xlsx?|bak)$/i.test(n))return 'backup data payload';
  // The app's deliberately empty recovery module must still pass verify:public.
  return null;
}
function checkFiles(files){return files.flatMap(file=>{const r=problem(file);return r?[{file,reason:r}]:[];});}
function stagedFiles(){
  const b=execFileSync('git',['diff','--cached','--name-only','-z'],{cwd:projectRoot});
  return b.toString('utf8').split('\0').filter(Boolean);
}
function main(){
  const files=stagedFiles();
  if(files.length===0){console.error('FAIL: no files are staged; nothing to publish.');process.exitCode=1;return;}
  const issues=checkFiles(files);
  // Reject symbolic links; a link can redirect to unsafe local content.
  const rows=execFileSync('git',['ls-files','--stage','-z'],{cwd:projectRoot}).toString('utf8').split('\0').filter(Boolean);
  for(const row of rows){if(/^120000\s/.test(row)){const filename=row.split('\t').slice(1).join('\t');issues.push({file:filename,reason:'symbolic link not allowed'});}}
  for(const issue of issues)console.error(`FAIL: private/generated: ${issue.file} (${issue.reason})`);
  if(issues.length){console.error('Upload stopped. No data was sent to GitHub.');process.exitCode=1;return;}
  console.log(`PASS: ${files.length} staged files checked for privacy.`);
  console.log('PASS: safe Markdown documentation, including database/backup-formats, is permitted.');
  // Underlying safe recovery module and known personal payload checked separately.
}
if(require.main===module)main();
module.exports={problem,checkFiles};
