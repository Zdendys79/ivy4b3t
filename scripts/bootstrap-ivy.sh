#!/bin/bash

# ------------------------------------------------------------------------
# Ivy4B3T – Bootstrap skript pro nový virtuální stroj
#
# Tento skript:
#   - Nainstaluje nebo aktualizuje NVM (Node Version Manager)
#   - Detekuje a nainstaluje nejnovější LTS verzi Node.js
#   - Odstraní staré verze Node.js
#   - Nainstaluje nebo aktualizuje Git
#
# Jak spustit na virtuálu (Ubuntu):
#   chmod +x ~/Sync/bootstrap-ivy.sh
#   ~/Sync/bootstrap-ivy.sh
# ------------------------------------------------------------------------

# -------------------- INSTALACE NVM + NODE.JS --------------------------

echo "📦 Instalace nebo aktualizace nvm..."
export NVM_DIR="$HOME/.nvm"
if [ -d "$NVM_DIR" ]; then
    echo "🔁 NVM již existuje, aktualizuji..."
    if command -v git >/dev/null 2>&1; then
        cd "$NVM_DIR" && git pull
    else
        echo "⚠️ Git není k dispozici, přeskočena aktualizace NVM."
    fi
else
    echo "⬇️ Instalace NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "🔍 Zjišťuji nejnovější LTS verzi Node.js..."
LATEST_LTS=$(nvm ls-remote --lts | tail -1 | awk '{print $1}')

if [[ "$LATEST_LTS" == v* ]]; then
    echo "⬇️ Instaluji Node.js $LATEST_LTS ..."
    nvm install "$LATEST_LTS"
    nvm alias default "$LATEST_LTS"
    nvm use default

    echo "🧹 Odstraňuji staré verze Node.js..."
    INSTALLED_VERSIONS=$(nvm ls --no-colors | grep -Eo 'v[0-9]+\.[0-9]+\.[0-9]+' | grep -v "$LATEST_LTS")
    for version in $INSTALLED_VERSIONS; do
        echo "❌ Odinstaluji $version ..."
        nvm uninstall "$version"
    done
else
    echo "❌ Nepodařilo se zjistit nejnovější verzi Node.js, instalace přeskočena."
fi

echo "✅ Aktuální Node.js verze:"
node -v
npm -v

# -------------------------- INSTALACE GIT ------------------------------

echo "📦 Instalace nebo aktualizace GIT..."
sudo apt update
sudo apt install -y git

echo "✅ Git verze:"
git --version

# -------------------------- DOKONČENO ----------------------------------

echo "🎉 Bootstrap dokončen – VM připraven pro běh Ivy klienta."
