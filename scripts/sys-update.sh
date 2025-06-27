#!/bin/bash

# full-update.sh
# Aktualizace systému, odstranění duplicitních zdrojů a restart

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

# 4. Restart systému
echo "[REBOOT] Restart systému za 10 vteřin (stiskni Ctrl+C pro zrušení)..."
sleep 10 
sudo reboot
