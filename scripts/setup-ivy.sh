#!/bin/bash

# ------------------------------------------------------------------------
# setup-ivy.sh – Kompletní instalace/aktualizace prostředí IVY4B3T klienta
# ------------------------------------------------------------------------
#
# Provádí:
#   - instalaci nebo aktualizaci NVM
#   - instalaci nejnovější verze Node.js (ne nutně LTS)
#   - aktualizaci NPM
#   - instalaci GITu
#   - klonování pouze složky "ivy" z repozitáře Zdendys79/ivy4b3t
#   - vytvoření konfiguračního souboru sql_config.json (s možností ponechat původní heslo)
#   - instalaci Node.js závislostí
#   - spuštění start.sh
# ------------------------------------------------------------------------

set -e

# === IDENTIFIKACE SKRIPTU ===
SCRIPT_PATH="$0"
SCRIPT_NAME=$(basename "$SCRIPT_PATH")
SCRIPT_MTIME=$(stat -c %y "$SCRIPT_PATH" 2>/dev/null | cut -d'.' -f1 || echo "neznámé datum")

echo "========================================"
echo "📄 Skript: $SCRIPT_NAME"
echo "📅 Poslední úprava: $SCRIPT_MTIME"
echo "========================================"
echo ""

# === DEFINICE PROMĚNNÝCH ===
NVM_INSTALL_SCRIPT="https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh"
REPO_URL="https://github.com/Zdendys79/ivy4b3t.git"
REPO_USER="Zdendys79"
REPO_EMAIL="zdendys79@gmail.com"
REPO_DIR=~/git/ivy4b3t
IVY_DIR=~/ivy
CONFIG_PATH="$IVY_DIR/sql/sql_config.json"
DB_HOST="83.167.224.200"
DB_USER="B3.remotes"
DB_NAME="ivy"

OLD_DB_PASS=""
USE_OLD="n"

# === 1. UPDATE NVM ===
echo -e "\n🔄 Instalace nebo aktualizace NVM..."
curl -o- "$NVM_INSTALL_SCRIPT" | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# === 2. INSTALACE STABILNÍ VERZE NODE.JS ===
echo -e "\n🔍 Instaluji stabilní verzi Node.js..."
nvm install stable
nvm alias default stable
nvm use default

# === 3. AKTUALIZACE NPM ===
echo -e "\n🔄 Aktualizuji NPM..."
npm install -g npm

# === 4. INSTALACE / AKTUALIZACE GIT A DALŠÍCH NÁSTROJŮ ===
echo -e "\n📦 Instalace nebo aktualizace GIT a nástrojů..."
sudo apt update
sudo apt install -y git jq

echo "✅ Git verze: $(git --version)"
echo "✅ Node.js: $(node -v)"
echo "✅ npm: $(npm -v)"

# === 5. NASTAVENÍ GIT CREDENTIALS ===
echo -e "\n🔐 Zadej svůj GitHub Personal Access Token (PAT):"
read -rsp "PAT: " GITHUB_PAT

echo -e "\n\n💾 Nastavuji Git config..."
git config --global user.name "$REPO_USER"
git config --global user.email "$REPO_EMAIL"
git config --global credential.helper store
echo "https://$REPO_USER:$GITHUB_PAT@github.com" > ~/.git-credentials

# === 6. ZÁLOHA PŮVODNÍHO SQL HESLA (pokud existuje) ===
if [ -f "$CONFIG_PATH" ]; then
  OLD_DB_PASS=$(jq -r '.password' "$CONFIG_PATH")
  echo -e "\n🔐 Načteno původní heslo k databázi."
fi

# === 7. MAZÁNÍ SLOŽEK ~/git a ~/ivy ===
echo -e "\n🧹 Mažu předchozí složky ~/git a ~/ivy..."
rm -rf ~/git "$IVY_DIR"

# === 8. KOPÍROVÁNÍ SLOŽKY IVY Z GIT REPO ===
echo -e "\n🔄 Klonuji pouze složku ivy z GitHub repozitáře..."
git clone --depth 1 --filter=blob:none --sparse "$REPO_URL" "$REPO_DIR"
cd "$REPO_DIR"
git sparse-checkout init --cone
git sparse-checkout set ivy

echo -e "\n📂 Kopíruji složku ivy do $IVY_DIR..."
mkdir -p "$IVY_DIR"
rsync -av --delete "$REPO_DIR/ivy/" "$IVY_DIR/"

# === 9. VYTVOŘENÍ SQL CONFIGU ===
echo -e "\n🔑 Nastavení přístupu k databázi:"
if [ -n "$OLD_DB_PASS" ]; then
  read -rp "Použít původní heslo z předchozí instalace? [Y/n]: " USE_OLD
fi

if [[ "$USE_OLD" =~ ^[Yy]$ || "$USE_OLD" == "" ]]; then
  DB_PASS="$OLD_DB_PASS"
else
  read -rsp "Zadej nové heslo pro DB uživatele $DB_USER: " DB_PASS
  echo
fi

mkdir -p "$IVY_DIR/sql"
cat > "$CONFIG_PATH" <<EOF
{
  "host": "$DB_HOST",
  "user": "$DB_USER",
  "password": "$DB_PASS",
  "database": "$DB_NAME"
}
EOF

# === 10. INSTALACE NODE.JS ZÁVISLOSTÍ ===
echo -e "\n📦 Instaluji závislosti..."
cd "$IVY_DIR"
npm install --omit=dev --no-audit --no-fund

# === 11. VÝBĚR A SPUŠTĚNÍ START SKRIPTU ===
echo -e "\n🚀 Vyber start skript:"
echo "1) start.sh (větev production)"
echo "2) main-start.sh (větev main)"
read -p "Zadej číslo [1-2]: " choice

case $choice in
    1)
        echo "Spouštím start.sh (production)..."
        chmod +x start.sh
        ./start.sh
        ;;
    2)
        echo "Spouštím main-start.sh (main)..."
        chmod +x main-start.sh
        ./main-start.sh
        ;;
    *)
        echo "Neplatná volba. Spouštím výchozí start.sh..."
        chmod +x start.sh
        ./start.sh
        ;;
esac

echo -e "\n🎉 Instalace dokončena. IVY klient je připraven."
