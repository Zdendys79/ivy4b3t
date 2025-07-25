﻿#!/bin/bash

# fix_crd_xfce.sh
# Umístění: ~/Sync/scripts/fix_crd_xfce.sh
# Účel: Nastavení výchozí relace pro Chrome Remote Desktop na Xfce a potlačení výzev při přihlášení

set -e

echo "[FIX] Vytvářím ~/.chrome-remote-desktop-session..."
echo "exec /usr/bin/xfce4-session" > ~/.chrome-remote-desktop-session
chmod +x ~/.chrome-remote-desktop-session

echo "[FIX] Instaluji Xfce4 a základní komponenty..."
sudo apt-get update
sudo apt-get install -y xfce4 xfce4-terminal xserver-xorg-core xinit dbus-x11

echo "[FIX] Kopíruji přednastavenou konfiguraci XFCE ze Sync/scripts/xfce4..."
mkdir -p ~/.config
rsync -av ~/Sync/scripts/xfce4/ ~/.config/xfce4/


echo "[FIX] Odstraňuji/zneplatňuji přihlašovací správce (gdm3, lightdm)..."
sudo systemctl disable gdm3 || true
sudo systemctl disable lightdm || true
sudo apt-get remove -y gdm3 lightdm || true

echo "[FIX] Ukládám ~/.profile s potlačením DISPLAY a podporou keyring..."

echo "[KEYBOARD] Nastavuji českou klávesnici pro terminál a grafiku..."
sudo localectl set-keymap cz
echo 'setxkbmap cz' >> ~/.xsessionrc
chmod +x ~/.xsessionrc

echo "[XFCE] Nastavuji počet pracovních ploch na 1..."
xfconf-query -c xfwm4 -p /general/workspace_count -s 1

cat > ~/.profile <<'EOF'
# ~/.profile: spouští se při login shellu

# Načti ~/.bashrc pokud existuje
if [ -n "$BASH_VERSION" ]; then
    if [ -f "$HOME/.bashrc" ]; then
        . "$HOME/.bashrc"
    fi
fi

# Rozšíření PATH
[ -d "$HOME/bin" ] && PATH="$HOME/bin:$PATH"
[ -d "$HOME/.local/bin" ] && PATH="$HOME/.local/bin:$PATH"

# Potlačí pokusy o X aplikace mimo grafické prostředí
if [ -z "$DISPLAY" ] && [ "$(tty)" != "/dev/tty1" ]; then
    export DISPLAY=
    return 0
fi

# Spuštění keyring daemonu pokud existuje (např. pro ssh)
if [ -z "$GNOME_KEYRING_CONTROL" ] && [ -x /usr/bin/gnome-keyring-daemon ]; then
    eval $(/usr/bin/gnome-keyring-daemon --start)
    export GNOME_KEYRING_CONTROL SSH_AUTH_SOCK
fi
EOF

echo "[XFCE] Vytvářím vlastní zástupce pro xfce4-terminal..."

mkdir -p ~/.local/share/applications
cat > ~/.local/share/applications/xfce4-terminal-custom.desktop <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Xfce Terminal (custom)
Comment=Maximized + Always on top
Exec=xfce4-terminal --maximize
StartupNotify=false
Terminal=false
Icon=utilities-terminal
EOF

chmod +x ~/.local/share/applications/xfce4-terminal-custom.desktop

# Zástupce na plochu
mkdir -p ~/Desktop
cp ~/.local/share/applications/xfce4-terminal-custom.desktop ~/Desktop/
chmod +x ~/Desktop/xfce4-terminal-custom.desktop

echo "[DONE] Chrome Remote Desktop by měl nyní fungovat čistě s Xfce bez výzev."
