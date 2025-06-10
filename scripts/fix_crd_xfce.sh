#!/bin/bash

# fix_crd_xfce.sh
# Umístění: ~/Sync/scripts/fix_crd_xfce.sh
# Účel: Nastavení výchozí relace pro Chrome Remote Desktop na Xfce a odstranění rušivých DE

set -e

echo "[FIX] Vytvářím ~/.chrome-remote-desktop-session..."
echo "exec /usr/bin/xfce4-session" > ~/.chrome-remote-desktop-session
chmod +x ~/.chrome-remote-desktop-session

echo "[FIX] Kontroluji instalaci xfce4..."
sudo apt-get update
sudo apt-get install -y xfce4 xfce4-terminal

echo "[FIX] Odstraňuji rušivá desktopová prostředí (gnome, kde)..."
sudo apt-get remove -y gnome-session gdm3 kde-plasma-desktop lightdm || true

echo "[FIX] Instalace minimal desktop manageru (Xfce preferred)..."
sudo apt-get install -y xserver-xorg-core xinit dbus-x11

echo "[FIX] Zakazuji přihlašovací správce (gdm3, lightdm)..."
sudo systemctl disable gdm3 || true
sudo systemctl disable lightdm || true

echo "[FIX] Hotovo. Po restartu by měl CRD spouštět Xfce bez výběru."
