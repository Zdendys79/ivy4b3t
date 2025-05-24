#!/bin/bash

# update_node_env.sh – aktualizuje NVM, Node.js a npm na nejnovější verze
# Jak spustit: chmod +x update_node_env.sh && ./update_node_env.sh

set -e

echo "🔄 Instalace nebo aktualizace NVM..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

export NVM_DIR="$HOME/.nvm"
# Načtení NVM do aktuálního shellu
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "🔍 Zjišťuji nejnovější verzi Node.js..."
LATEST_NODE=$(nvm ls-remote | tail -1 | awk '{print $1}' | tr -d 'v')
echo "📦 Nejnovější verze Node.js: v$LATEST_NODE"

echo "⬇️ Instalace Node.js v$LATEST_NODE přes NVM..."
nvm install $LATEST_NODE
nvm alias default $LATEST_NODE
nvm use $LATEST_NODE

echo "🔄 Aktualizace NPM na nejnovější verzi..."
npm install -g npm

echo ""
echo "✅ Finální verze:"
echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"

