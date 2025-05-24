# commit.ps1 – PowerShell skript pro ruční commit v Gitu s dotazem na zprávu

# Nastavení pracovní složky
Set-Location -Path "E:\B3projekty\ivy4b3t"

# Zeptáme se na zprávu ke commitu
$message = Read-Host "Zadej zprávu pro commit"

# Přidání všech změn
git add .

# Provedení commitu
git commit -m "$message"

# Push na GitHub
git push origin main
