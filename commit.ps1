# commit.ps1 - Automatický commit skript pro projekt ivy4b3t
# Uchovává všechny původní kroky + umožňuje zadat víceřádkový popis v Notepadu

# Nastav encoding konzole (kvůli českým znakům)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=== 🐙 Commit skript pro B3 ==="

# 1️⃣ Kontrola, jestli jsou změny
$hasChanges = git status --porcelain

# 2️⃣ Pokud změny existují, proveď stash
$stashed = $false
if ($hasChanges) {
    Write-Host "[GIT] Necommitované změny nalezeny, provádím stash..."
    git stash save "Auto-stash před pull"
    $stashed = $true
} else {
    Write-Host "[GIT] Žádné změny, stash není potřeba."
}

# 3️⃣ Pull aktuálního stavu z GITu
Write-Host "[GIT] Aktualizuji repozitář (git pull)..."
git pull

# 4️⃣ Vrácení stashnutých změn (pokud byly)
if ($stashed) {
    Write-Host "[GIT] Vracím stash zpět..."
    git stash pop
}

# 5️⃣ Získání zprávy z externího editoru
$tempFile = "$env:TEMP\commit_message.txt"
if (Test-Path $tempFile) { Remove-Item $tempFile }
New-Item -ItemType File -Path $tempFile | Out-Null

$p = Start-Process -FilePath "notepad.exe" -ArgumentList $tempFile -PassThru
$p.WaitForExit()

if ((Get-Content $tempFile -Raw).Trim().Length -eq 0) {
    Write-Host "❌ Commit message je prázdná. Commit zrušen."
    exit 1
}

# 6️⃣ Commit změn
Write-Host "[GIT] Přidávám všechny změny..."
git add -A

Write-Host "[GIT] Vytvářím commit..."
git commit -F $tempFile

# 7️⃣ Push
Write-Host "[GIT] Odesílám commit na vzdálený repozitář..."
git push

# Úklid
Remove-Item $tempFile

Write-Host "✅ Commit byl úspěšně proveden a odeslán."
