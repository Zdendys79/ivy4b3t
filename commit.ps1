# commit.ps1 - Automatic commit script for ivy4b3t project
# Preserves all original steps + allows multi-line description input via Notepad

# Set console encoding (for proper character handling)
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null

Write-Host "=== 🐙 Commit Script for B3 ==="

# 1️⃣ First, ensure we're up to date with remote
Write-Host "[GIT] Synchronizing with remote repository..."

# Show current changes (if any)
$changes = git status --porcelain
if ($changes) {
    Write-Host "📋 Found uncommitted changes:"
    git status --short
    Write-Host "📦 These changes will be included in the commit"
} else {
    Write-Host "✅ No uncommitted changes found"
}

# Pull latest changes from remote
Write-Host "[GIT] Pulling latest changes..."
git pull
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git pull failed. Please resolve any issues manually and try again."
    exit 1
}

Write-Host "✅ Repository synchronized with remote"

# 2️⃣ Get commit message from external editor
$tempFile = "$env:TEMP\commit_message.txt"
if (Test-Path $tempFile) { Remove-Item $tempFile }
New-Item -ItemType File -Path $tempFile | Out-Null

$p = Start-Process -FilePath "notepad.exe" -ArgumentList $tempFile -PassThru
$p.WaitForExit()

if ((Get-Content $tempFile -Raw).Trim().Length -eq 0) {
    Write-Host "❌ Commit message is empty. Commit cancelled."
    exit 1
}

# 6️⃣ Commit changes
Write-Host "[GIT] Adding all changes..."
git add -A

Write-Host "[GIT] Creating commit..."
git commit -F $tempFile

# 3️⃣ Push
Write-Host "[GIT] Pushing commit to remote repository..."
git push

# Cleanup
Remove-Item $tempFile

Write-Host "✅ Commit was successfully created and pushed."