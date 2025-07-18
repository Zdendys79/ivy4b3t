#!/bin/bash

# ------------------------------------------------------------------------
# update-node-env.sh – Aktualizace vývojového prostředí Node.js
#
# Provádí:
#   - instalaci nebo aktualizaci NVM (Node Version Manager)
#   - instalaci nejnovější verze Node.js
#   - aktualizaci NPM (Node Package Manager)
# ------------------------------------------------------------------------

set -e

# === 1. INSTALACE / AKTUALIZACE NVM ===
echo -e "\n🔄 Instalace nebo aktualizace NVM..."
# Používáme oficiální instalační skript z GitHubu
curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh" | bash

# Načtení NVM do aktuálního shellu, aby bylo možné ho hned použít
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
else
  echo "❌ Chyba: NVM se nepodařilo načíst. Zkuste restartovat terminál."
  exit 1
fi
echo "✅ NVM je připraveno."


# === 2. INSTALACE NEJNOVĚJŠÍ VERZE NODE.JS ===
echo -e "\n🔍 Zjišťuji nejnovější verzi Node.js..."
# Získáme poslední řádek z výpisu a z něj první sloupec (verzi)
LATEST_NODE=$(nvm ls-remote | grep -v 'unstable' | tail -1 | awk '{print $1}')

if [ -z "$LATEST_NODE" ]; then
    echo "❌ Nepodařilo se zjistit nejnovější verzi Node.js."
    exit 1
fi

echo "⬇️  Instaluji nebo přepínám na Node.js verzi: $LATEST_NODE..."
nvm install "$LATEST_NODE"
nvm alias default "$LATEST_NODE"
nvm use default


# === 3. AKTUALIZACE NPM ===
echo -e "\n🔄 Aktualizuji NPM na nejnovější verzi..."
npm install -g npm


# === 4. KONTROLNÍ VÝPIS ===
echo -e "\n🎉 Aktualizace dokončena!"
echo "Verze nástrojů:"
echo "  - Node.js: $(node -v)"
echo "  - npm:     $(npm -v)"
echo "  - nvm:     $(nvm --version)"

exit 0
