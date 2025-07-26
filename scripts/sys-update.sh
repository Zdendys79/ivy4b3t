#!/bin/bash

# sys-update.sh
# Aktualizace systému, odstranění duplicitních zdrojů a restart

# === PŘED SPUŠTĚNÍM ===
# 1. Vypněte Syncthing: systemctl --user stop syncthing
# 2. Odstraňte obsah ~/Sync: rm -rf ~/Sync/*
# 3. Znovu vytvořte složku: mkdir -p ~/Sync/scripts
# 4. Vložte tento soubor jako: nano ~/Sync/scripts/sys-update.sh
# 5. Proveďte a spusťte: chmod +x ~/Sync/scripts/sys-update.sh && ~/Sync/scripts/sys-update.sh

# 1. Čistíme duplicitní zdroje Chrome Remote Desktop
if [ -f /etc/apt/sources.list.d/chrome-remote-desktop.list ]; then
  echo "[CLEANUP] Odstraňuji duplicitní .list pro chrome-remote-desktop..."
  sudo rm /etc/apt/sources.list.d/chrome-remote-desktop.list
fi

# 2. Aktualizace systému včetně phased balíků
echo "[UPDATE] Spouštím plnou aktualizaci včetně phased updates..."
sudo apt -o APT::Get::Always-Include-Phased-Updates=true update
sudo apt -o APT::Get::Always-Include-Phased-Updates=true upgrade -y

# 3. Odstranění nepoužívaných balíků
echo "[CLEANUP] Odstraňuji nepotřebné balíky..."
sudo apt autoremove -y

# 4. Zajištění automatického spuštění Syncthingu
echo "[SYNCTHING] Povoluji autospuštění Syncthingu..."
systemctl --user enable syncthing
sudo loginctl enable-linger "$USER"

# 5. Restart systému
echo "[REBOOT] Restart systému za 10 vteřin (stiskni Ctrl+C pro zrušení)..."
sleep 10
sudo reboot
