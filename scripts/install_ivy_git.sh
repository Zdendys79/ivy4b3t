#!/bin/bash
# install_ivy_git.sh – čistá instalace Puppeteer klienta z GITu
# Použití: chmod +x install_ivy_git.sh && ./install_ivy_git.sh

set -e

echo "[1/9] Mažu původní složky ~/git a ~/ivy..."
rm -rf ~/git ~/ivy

echo "[2/9] Zadej svůj GitHub Personal Access Token (PAT):"
read -rsp "PAT: " GITHUB_PAT
echo

git config --global user.name "Zdendys79"
git config --global user.email "zdendys79@gmail.com"
git config --global credential.helper store

echo "https://Zdendys79:$GITHUB_PAT@github.com" > ~/.git-credentials

echo "[3/9] Klonuji pouze složku ivy z GitHub repozitáře..."
git clone --depth 1 --filter=blob:none --sparse https://github.com/Zdendys79/ivy4b3t.git ~/git/ivy4b3t

cd ~/git/ivy4b3t
git sparse-checkout init --cone
git sparse-checkout set ivy

echo "[4/9] Kopíruji složku ivy do ~/ivy..."
mkdir -p ~/ivy
rsync -av --delete ~/git/ivy4b3t/ivy/ ~/ivy/

echo "[5/9] Vytvářím sql/sql_config.json..."
cd ~/ivy/sql || { echo "Chyba: složka sql neexistuje"; exit 1; }

read -rsp "Zadej heslo pro uživatele B3.remotes: " DB_PASS
echo

cat > sql_config.json <<EOF
{
  "host": "83.167.224.200",
  "user": "B3.remotes",
  "password": "$DB_PASS",
  "database": "ivy"
}
EOF

echo "[6/9] Přecházím do ~/ivy..."
cd ~/ivy

echo "[7/9] Spouštím npm install..."
npm install

echo "[8/9] Nastavuji start.sh jako spustitelný..."
chmod +x start.sh

echo "[9/9] Spouštím start.sh..."
./start.sh
