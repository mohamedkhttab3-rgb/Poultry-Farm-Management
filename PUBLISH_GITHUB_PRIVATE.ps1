# Poultry Farm Management V7.1 - safe private source publisher.
# Fix: never call `git remote get-url origin` before verifying it exists.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$repo = 'https://github.com/mohamedkhttab3-rgb/Poultry-Farm-Management.git'
Write-Host 'Poultry Farm Management V7.1 - PRIVATE SOURCE UPLOAD' -ForegroundColor Cyan
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Install Git for Windows first.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22+ first.' }

# Keep all original source/native/privacy checks unchanged.
& node scripts/verify-source.cjs
if ($LASTEXITCODE -ne 0) { throw 'Source verification failed' }
& node scripts/verify-public.cjs
if ($LASTEXITCODE -ne 0) { throw 'Privacy verification failed' }
& node scripts/verify-native.cjs
if ($LASTEXITCODE -ne 0) { throw 'Native verification failed' }

Write-Host "Will upload to: $repo" -ForegroundColor Yellow
$confirm = Read-Host 'Type YES to upload only SAFE source files into this PRIVATE GitHub repo'
if ($confirm -cne 'YES') { throw 'Cancelled; nothing uploaded' }

if (-not (Test-Path -LiteralPath '.git')) {
    & git init
    if ($LASTEXITCODE -ne 0) { throw 'git init failed' }
}
& git branch -M main
if ($LASTEXITCODE -ne 0) { throw 'Failed to select main branch' }

# `git remote get-url origin` emits a native error when origin has never been set.
# Enumerate remotes safely first, so a partially completed first upload is recoverable.
$remoteNames = @(& git remote)
if ($LASTEXITCODE -ne 0) { throw 'Could not list Git remotes' }
if ($remoteNames -contains 'origin') {
    $remote = (& git remote get-url origin | Select-Object -First 1)
    if ($LASTEXITCODE -ne 0) { throw 'Could not read the existing origin remote' }
    if (($remote -ne $repo) -and ($remote -ne ($repo -replace '\.git$', ''))) {
        throw "Origin points to a different repository: $remote. No files uploaded."
    }
    Write-Host 'Existing origin verified.' -ForegroundColor Green
} else {
    & git remote add origin $repo
    if ($LASTEXITCODE -ne 0) { throw 'Failed to add the GitHub origin remote' }
    Write-Host 'Origin configured successfully.' -ForegroundColor Green
}

if (-not (& git config user.name)) { & git config user.name 'Poultry Farm Management Builder' }
if (-not (& git config user.email)) { & git config user.email 'pfm-build@users.noreply.github.com' }

& git add -A
if ($LASTEXITCODE -ne 0) { throw 'git add failed' }

# Verify the actual staged files, not folder names containing words such as backup.
# Safe documentation (database/backup-formats/*.md) is permitted. Actual user
# backup payloads, credentials, and generated executables are rejected.
& node scripts/check-staged-safe.cjs
if ($LASTEXITCODE -ne 0) { throw 'Sensitive or generated files detected in the Git staging area; upload aborted.' }

$changes = @(& git status --porcelain)
if ($LASTEXITCODE -ne 0) { throw 'Could not read Git working tree status' }
if ($changes.Count -gt 0) {
    & git commit -m 'Poultry Farm Management V7.1: safe uploader and native build source'
    if ($LASTEXITCODE -ne 0) { throw 'Git commit failed' }
} else {
    Write-Host 'Nothing new to commit; trying to push existing main branch.' -ForegroundColor Yellow
}

Write-Host 'Uploading. GitHub may open a browser sign-in window.' -ForegroundColor Cyan
& git push -u origin main
if ($LASTEXITCODE -ne 0) { throw 'Upload failed. Share the last red error lines.' }
Write-Host 'SUCCESS - source uploaded to the private repository. Open Actions: https://github.com/mohamedkhttab3-rgb/Poultry-Farm-Management/actions' -ForegroundColor Green
