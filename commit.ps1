# commit.ps1 - Automatic commit script for ivy4b3t project
# Preserves all original steps + allows multi-line description input via Notepad

# Set console encoding (for proper character handling)
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null

Write-Host "=== 🐙 Commit Script for B3 ==="

# 1️⃣ Check if there are changes
$hasChanges = git status --porcelain

# 2️⃣ If changes exist, perform stash
$stashed = $false
if ($hasChanges) {
    Write-Host "[GIT] Uncommitted changes found, performing stash..."
    git stash save "Auto-stash before pull"
    $stashed = $true
} else {
    Write-Host "[GIT] No changes found, stash not needed."
}

# 3️⃣ Pull current state from GIT
Write-Host "[GIT] Updating repository (git pull)..."
git pull

# 4️⃣ Restore stashed changes (if any)
if ($stashed) {
    Write-Host "[GIT] Restoring stash..."
    git stash pop
}

# 5️⃣ Get commit message from external editor
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

# 7️⃣ Push
Write-Host "[GIT] Pushing commit to remote repository..."
git push

# Cleanup
Remove-Item $tempFile

Write-Host "✅ Commit was successfully created and pushed."