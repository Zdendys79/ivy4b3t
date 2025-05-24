#!/bin/bash

# ------------------------------------------------------------------------
# Ivy4B3T – Instalace nejnovější LTS verze Node.js pomocí NVM
#
# Jak spustit:
#   chmod +x ~/Sync/install-latest-node.sh
#   ~/Sync/install-latest-node.sh
# ------------------------------------------------------------------------

echo "📦 Instalace nebo aktualizace nvm..."
export NVM_DIR="$HOME/.nvm"
if [ -d "$NVM_DIR" ]; then
    echo "🔁 NVM již existuje, aktualizuji..."
    cd "$NVM_DIR" && git pull
else
    echo "⬇️ Instalace NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# Aktivace nvm v tomto shellu
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "🔍 Zjišťuji nejnovější LTS verzi Node.js..."
LATEST_LTS=$(nvm ls-remote --lts | tail -1 | awk '{print $1}')

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

echo "✅ Instalace hotová:"
node -v
npm -v
