#!/bin/bash

# ------------------------------------------------------------------------
# setup-ivy.sh – Kompletní instalace/aktualizace prostředí IVY4B3T klienta
#
# Provádí:
#   - instalaci nebo aktualizaci NVM
#   - instalaci nejnovější verze Node.js (ne nutně LTS)
#   - aktualizaci NPM
#   - instalaci GITu
#   - klonování pouze složky "ivy" z repozitáře Zdendys79/ivy4b3t
#   - vytvoření konfiguračního souboru sql_config.json (s dotazem na údaje)
#   - instalaci Node.js závislostí
#   - spuštění start.sh
# ------------------------------------------------------------------------

set -e

# === DEFINICE PROMĚNNÝCH ===
NVM_INSTALL_SCRIPT="https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh"
REPO_URL="https://github.com/Zdendys79/ivy4b3t.git"
REPO_USER="Zdendys79"
REPO_EMAIL="zdendys79@gmail.com"
REPO_DIR=~/git/ivy4b3t
IVY_DIR=~/ivy
CONFIG_PATH="$IVY_DIR/sql/sql_config.json"

# Databázové údaje - ŽÁDNÉ HARDCODED HODNOTY!
DB_HOST=""
DB_USER=""
DB_NAME=""
DB_PASS=""

OLD_DB_PASS=""
USE_OLD="n"

# === INTERAKTIVNÍ ZÍSKÁNÍ DATABÁZOVÝCH ÚDAJŮ ===
echo -e "\n🔐 KONFIGURACE DATABÁZOVÉHO PŘIPOJENÍ"
echo "======================================"

# Zkontrolovat zda existuje starý config
if [ -f "$CONFIG_PATH" ]; then
  OLD_DB_PASS=$(jq -r '.password' "$CONFIG_PATH" 2>/dev/null || echo "")
  if [ -n "$OLD_DB_PASS" ] && [ "$OLD_DB_PASS" != "null" ]; then
    echo "📁 Nalezen existující config soubor s heslem."
    read -rp "Použít heslo z předchozí instalace? [Y/n]: " USE_OLD
  fi
fi

# Získat databázové údaje od uživatele
echo -e "\n📝 Zadej údaje pro připojení k databázi:"

# DB Host
read -rp "DB Host: " DB_HOST

# DB User  
read -rp "DB User: " DB_USER

# DB Name
read -rp "DB Name: " DB_NAME

# DB Password
if [[ "$USE_OLD" =~ ^[Yy]$ || "$USE_OLD" == "" ]] && [ -n "$OLD_DB_PASS" ]; then
  DB_PASS="$OLD_DB_PASS"
  echo "✅ Používám existující heslo."
else
  echo "🔑 Zadej heslo pro databázového uživatele '$DB_USER':"
  read -rsp "Password: " DB_PASS
  echo ""
fi

# Validace údajů
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ] || [ -z "$DB_PASS" ]; then
  echo "❌ CHYBA: Všechny databázové údaje jsou povinné!"
  echo "   DB Host: '$DB_HOST'"
  echo "   DB User: '$DB_USER'" 
  echo "   DB Name: '$DB_NAME'"
  echo "   DB Pass: [SKRYTO]"
  exit 1
fi

echo -e "\n✅ Databázová konfigurace:"
echo "   Host: $DB_HOST"
echo "   User: $DB_USER" 
echo "   Database: $DB_NAME"
echo "   Password: [SKRYTO]"

# === 1. UPDATE NVM ===
echo -e "\n🔄 Instalace nebo aktualizace NVM..."
curl -o- "$NVM_INSTALL_SCRIPT" | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# === 2. INSTALACE NEJNOVĚJŠÍ NODE.JS (nemusí být LTS) ===
echo -e "\n🔍 Zjišťuji nejnovější verzi Node.js..."
LATEST_NODE=$(nvm ls-remote | tail -1 | awk '{print $1}')
echo "⬇️ Instaluji Node.js $LATEST_NODE ..."
nvm install $LATEST_NODE
nvm alias default $LATEST_NODE
nvm use default

# === 3. AKTUALIZACE NPM ===
echo -e "\n🔄 Aktualizuji NPM..."
npm install -g npm

# === 4. INSTALACE / AKTUALIZACE GIT ===
echo -e "\n📦 Instalace nebo aktualizace GIT..."
sudo apt update
sudo apt install -y git

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

# === 6. MAZÁNÍ SLOŽEK ~/git a ~/ivy ===
echo -e "\n🧹 Mažu předchozí složky ~/git a ~/ivy..."
rm -rf ~/git "$IVY_DIR"

# === 7. KOPÍROVÁNÍ SLOŽKY IVY Z GIT REPO ===
echo -e "\n🔄 Klonuji pouze složku ivy z GitHub repozitáře..."
git clone --depth 1 --filter=blob:none --sparse "$REPO_URL" "$REPO_DIR"
cd "$REPO_DIR"
git sparse-checkout init --cone
git sparse-checkout set ivy

echo -e "\n📂 Kopíruji složku ivy do $IVY_DIR..."
mkdir -p "$IVY_DIR"
rsync -av --delete "$REPO_DIR/ivy/" "$IVY_DIR/"

# === 8. VYTVOŘENÍ SQL CONFIGU ===
echo -e "\n📝 Vytvářím sql_config.json..."
mkdir -p "$IVY_DIR/sql"
cat > "$CONFIG_PATH" <<EOF
{
  "host": "$DB_HOST",
  "user": "$DB_USER",
  "password": "$DB_PASS",
  "database": "$DB_NAME"
}
EOF

echo "✅ Konfigurační soubor vytvořen: $CONFIG_PATH"

# === 9. NASTAVENÍ ENVIRONMENT VARIABLES ===
echo -e "\n🌍 Nastavuji environment variables..."

# Přidat do .bashrc pokud ještě není
if ! grep -q "# IVY Database Config" ~/.bashrc; then
  echo "" >> ~/.bashrc
  echo "# IVY Database Config" >> ~/.bashrc
  echo "export DB_HOST=\"$DB_HOST\"" >> ~/.bashrc
  echo "export DB_USER=\"$DB_USER\"" >> ~/.bashrc
  echo "export DB_PASS=\"$DB_PASS\"" >> ~/.bashrc
  echo "export DB_NAME=\"$DB_NAME\"" >> ~/.bashrc
  echo "✅ Environment variables přidány do ~/.bashrc"
else
  echo "⚠️  Environment variables už jsou v ~/.bashrc"
fi

# Nastavit pro současnou session
export DB_HOST="$DB_HOST"
export DB_USER="$DB_USER"
export DB_PASS="$DB_PASS"
export DB_NAME="$DB_NAME"

# === 10. INSTALACE NODE.JS ZÁVISLOSTÍ ===
echo -e "\n📦 Instaluji závislosti..."
cd "$IVY_DIR"
npm install --omit=dev --no-audit --no-fund

# === 11. SPUŠTĚNÍ START.SH ===
echo -e "\n🚀 Spouštím start.sh..."
chmod +x start.sh

echo -e "\n🎉 Instalace dokončena!"
echo "📋 Konfigurace:"
echo "   Databáze: $DB_HOST/$DB_NAME"
echo "   Uživatel: $DB_USER"
echo "   Config: $CONFIG_PATH"
echo "   Environment variables: nastaveny"
echo ""
echo "▶️  Spouštím IVY klient..."
./start.sh