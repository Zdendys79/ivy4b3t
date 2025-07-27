#!/bin/bash
# NEBEZPEČNÉ! Smaže celou Git historii a vytvoří nový initial commit

echo "⚠️  VAROVÁNÍ: Toto smaže CELOU Git historii!"
echo "Přijdeš o všechny commity a historii změn!"
echo ""
read -p "Opravdu chceš pokračovat? (ano/ne): " confirm

if [ "$confirm" != "ano" ]; then
    echo "Operace zrušena."
    exit 0
fi

echo "🗑️  Mažu Git historii..."

# Zálohuj současný stav
git stash

# Smaž .git složku
rm -rf .git

# Vytvoř nový git repozitář
git init

# Přidej všechny soubory
git add -A

# Vytvoř nový initial commit
git commit -m "Initial commit - historie vyčištěna z bezpečnostních důvodů"

# Přidej remote origin
git remote add origin https://github.com/Zdendys79/ivy4b3t.git

# Force push do remote (smaže historii i na GitHubu)
echo "📤 Nahrávám na GitHub (smaže remote historii)..."
git push -u origin main --force

echo "✅ Git historie byla smazána a nahrazena novým initial commitem"