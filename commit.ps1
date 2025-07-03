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
    
    # Try to pop stash and check for conflicts
    $stashResult = git stash pop 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️ Merge conflicts detected during stash pop!"
        Write-Host "Please resolve conflicts manually and then run:"
        Write-Host "  git add -A"
        Write-Host "  git stash drop"
        Write-Host "  .\commit.ps1"
        exit 1
    } else {
        Write-Host "[GIT] Stash restored successfully."
    }
    
    # Additional check for unresolved conflicts
    $conflictFiles = git status --porcelain | Select-String "^UU|^AA|^DD|^AU|^UA|^DU|^UD"
    if ($conflictFiles) {
        Write-Host "❌ Unresolved merge conflicts found:"
        $conflictFiles | ForEach-Object { Write-Host $_.Line }
        Write-Host ""
        Write-Host "Please resolve conflicts manually:"
        Write-Host "1. Edit conflicted files"
        Write-Host "2. Remove conflict markers (<<<<<<< ======= >>>>>>>)"
        Write-Host "3. Run: git add <resolved-files>"
        Write-Host "4. Run: .\commit.ps1"
        exit 1
    }
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

# 6️⃣ Final conflict check before commit
$conflictFiles = git status --porcelain | Select-String "^UU|^AA|^DD|^AU|^UA|^DU|^UD"
if ($conflictFiles) {
    Write-Host "❌ Cannot commit: Unresolved merge conflicts still exist!"
    $conflictFiles | ForEach-Object { Write-Host $_.Line }
    Remove-Item $tempFile
    exit 1
}

# Commit changes
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