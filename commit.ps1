# commit.ps1 - Hlavní složka projektu ivy4b3t
# Skript pro automatický stash/pull/pop a commit/push proceduru

# Nastav encoding konzole (kvůli českým znakům)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=== 🐙 Commit skript pro B3 ==="

# 1️⃣ Kontrola, jestli jsou změny
$hasChanges = git status --porcelain

# 2️⃣ Pokud změny existují, proveď stash
if ($hasChanges) {
    Write-Host "[GIT] Necommitované změny nalezeny, provádím stash..."
    git stash save "Auto-stash před pull"
} else {
    Write-Host "[GIT] Žádné změny, stash není potřeba."
}

# 3️⃣ Proveď git pull
Write-Host "[GIT] Provádím git pull..."
git pull

# 4️⃣ Pokud byl stash proveden, proveď pop
if ($hasChanges) {
    Write-Host "[GIT] Vrácení změn ze stash (pop)..."
    git stash pop
}

# 5️⃣ Zapiš verzi do package.json (tvůj pre-commit krok)
$hash = git rev-parse --short HEAD
Write-Host "[PRE-COMMIT] Zapisování verze do souboru package.json"
(Get-Content package.json -Raw) -replace '(?<=("version": ")(.*?)(?="))', $hash | Set-Content package.json -Encoding utf8
Write-Host "[PRE-COMMIT] Zapsána verze $hash do package.json."

# 6️⃣ Připrav commit
$commitMessage = Read-Host "Zadej zprávu pro commit"
git add .
git commit -m "$commitMessage"

# 7️⃣ Push na vzdálený repozitář
Write-Host "[GIT] Odesílám změny na GitHub..."
git push

Write-Host "=== ✅ Commit skript dokončen ==="
