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
REPO_EMAIL="31669093+Zdendys79@users.noreply.github.com"
REPO_DIR=~/git/ivy4b3t
IVY_DIR=~/ivy

# Databázové údaje - načteme z env nebo config
DB_HOST=""
DB_USER=""
DB_NAME=""
DB_PASS=""

# Pro uchování původních hodnot
ORIG_DB_HOST=""
ORIG_DB_USER=""
ORIG_DB_NAME=""
ORIG_DB_PASS=""

# === NAČTENÍ EXISTUJÍCÍCH HODNOT ===
echo -e "\n🔍 Hledám existující databázové údaje..."

# 1. Zkusit načíst z environment variables
if [ -n "$DB_HOST" ]; then
  ORIG_DB_HOST="$DB_HOST"
  echo "✅ Nalezen DB_HOST v environment: $ORIG_DB_HOST"
fi

if [ -n "$DB_USER" ]; then
  ORIG_DB_USER="$DB_USER"
  echo "✅ Nalezen DB_USER v environment: $ORIG_DB_USER"
fi

if [ -n "$DB_NAME" ]; then
  ORIG_DB_NAME="$DB_NAME"
  echo "✅ Nalezen DB_NAME v environment: $ORIG_DB_NAME"
fi

if [ -n "$DB_PASS" ]; then
  ORIG_DB_PASS="$DB_PASS"
  echo "✅ Nalezeno DB_PASS v environment: [SKRYTO]"
fi

# 2. Zkusit načíst z ~/.bashrc (pokud ještě nejsou v env)
if [ -f ~/.bashrc ]; then
  echo "📁 Hledám existující konfiguraci v ~/.bashrc"
  
  if [ -z "$ORIG_DB_HOST" ]; then
    TEMP_HOST=$(grep "export DB_HOST=" ~/.bashrc 2>/dev/null | cut -d'"' -f2)
    if [ -n "$TEMP_HOST" ]; then
      ORIG_DB_HOST="$TEMP_HOST"
      echo "✅ Načten host z ~/.bashrc: $ORIG_DB_HOST"
    fi
  fi
  
  if [ -z "$ORIG_DB_USER" ]; then
    TEMP_USER=$(grep "export DB_USER=" ~/.bashrc 2>/dev/null | cut -d'"' -f2)
    if [ -n "$TEMP_USER" ]; then
      ORIG_DB_USER="$TEMP_USER"
      echo "✅ Načten user z ~/.bashrc: $ORIG_DB_USER"
    fi
  fi
  
  if [ -z "$ORIG_DB_NAME" ]; then
    TEMP_NAME=$(grep "export DB_NAME=" ~/.bashrc 2>/dev/null | cut -d'"' -f2)
    if [ -n "$TEMP_NAME" ]; then
      ORIG_DB_NAME="$TEMP_NAME"
      echo "✅ Načtena database z ~/.bashrc: $ORIG_DB_NAME"
    fi
  fi
  
  if [ -z "$ORIG_DB_PASS" ]; then
    TEMP_PASS=$(grep "export DB_PASS=" ~/.bashrc 2>/dev/null | cut -d'"' -f2)
    if [ -n "$TEMP_PASS" ]; then
      ORIG_DB_PASS="$TEMP_PASS"
      echo "✅ Načteno password z ~/.bashrc: [SKRYTO]"
    fi
  fi
fi

# === INTERAKTIVNÍ ZÍSKÁNÍ DATABÁZOVÝCH ÚDAJŮ ===
echo -e "\n🔐 KONFIGURACE DATABÁZOVÉHO PŘIPOJENÍ"
echo "======================================"
echo "ℹ️  Pro použití původní hodnoty stiskni ENTER"
echo ""

# DB Host
if [ -n "$ORIG_DB_HOST" ]; then
  read -rp "DB Host [$ORIG_DB_HOST]: " DB_HOST
  if [ -z "$DB_HOST" ]; then
    DB_HOST="$ORIG_DB_HOST"
  fi
else
  read -rp "DB Host: " DB_HOST
fi

# DB User
if [ -n "$ORIG_DB_USER" ]; then
  read -rp "DB User [$ORIG_DB_USER]: " DB_USER
  if [ -z "$DB_USER" ]; then
    DB_USER="$ORIG_DB_USER"
  fi
else
  read -rp "DB User: " DB_USER
fi

# DB Name
if [ -n "$ORIG_DB_NAME" ]; then
  read -rp "DB Name [$ORIG_DB_NAME]: " DB_NAME
  if [ -z "$DB_NAME" ]; then
    DB_NAME="$ORIG_DB_NAME"
  fi
else
  read -rp "DB Name: " DB_NAME
fi

# DB Password
if [ -n "$ORIG_DB_PASS" ]; then
  echo "🔑 Nalezeno existující heslo"
  read -rp "Použít původní heslo? [Y/n]: " USE_PASS
  if [[ "$USE_PASS" =~ ^[Nn]$ ]]; then
    read -rsp "Zadej nové heslo: " DB_PASS
    echo ""
  else
    DB_PASS="$ORIG_DB_PASS"
    echo "✅ Používám původní heslo"
  fi
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

# === 8. NASTAVENÍ ENVIRONMENT VARIABLES ===
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
  # Aktualizovat existující hodnoty
  sed -i "/export DB_HOST=/c\export DB_HOST=\"$DB_HOST\"" ~/.bashrc
  sed -i "/export DB_USER=/c\export DB_USER=\"$DB_USER\"" ~/.bashrc
  sed -i "/export DB_PASS=/c\export DB_PASS=\"$DB_PASS\"" ~/.bashrc
  sed -i "/export DB_NAME=/c\export DB_NAME=\"$DB_NAME\"" ~/.bashrc
  echo "✅ Environment variables aktualizovány v ~/.bashrc"
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
