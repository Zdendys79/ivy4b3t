#!/bin/bash

# sys-update.sh
# Aktualizace systému, odstranění duplicitních zdrojů a restart

# === LOGGING SETUP ===
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/sys-update-$(hostname).txt"
echo "=== SYS-UPDATE SCRIPT START ===" | tee "$LOG_FILE"
echo "Datum: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "Hostname: $(hostname)" | tee -a "$LOG_FILE"
echo "User: $(whoami)" | tee -a "$LOG_FILE"
echo "Script verze s loggingem" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# === PŘED SPUŠTĚNÍM ===
# 1. Vypněte Syncthing: systemctl --user stop syncthing
# 2. Odstraňte obsah ~/Sync: rm -rf ~/Sync/*
# 3. Znovu vytvořte složku: mkdir -p ~/Sync/scripts
# 4. Vložte tento soubor jako: nano ~/Sync/scripts/sys-update.sh
# 5. Proveďte a spusťte: chmod +x ~/Sync/scripts/sys-update.sh && ~/Sync/scripts/sys-update.sh

# 1. Čistíme duplicitní zdroje Chrome Remote Desktop
echo "[CLEANUP] Kontroluji Chrome Remote Desktop duplicity..." | tee -a "$LOG_FILE"
if [ -f /etc/apt/sources.list.d/chrome-remote-desktop.list ]; then
  echo "[CLEANUP] Odstraňuji duplicitní .list pro chrome-remote-desktop..." | tee -a "$LOG_FILE"
  sudo rm /etc/apt/sources.list.d/chrome-remote-desktop.list
else
  echo "[CLEANUP] Žádné duplicitní .list soubory nenalezeny" | tee -a "$LOG_FILE"
fi

# 2. Aktualizace systému včetně phased balíků
echo "[UPDATE] Spouštím plnou aktualizaci včetně phased updates..." | tee -a "$LOG_FILE"
sudo apt -o APT::Get::Always-Include-Phased-Updates=true update | tee -a "$LOG_FILE"
sudo apt -o APT::Get::Always-Include-Phased-Updates=true upgrade -y | tee -a "$LOG_FILE"

# 3. Instalace Noto Mono fontu pro Unicode podporu v terminálu
echo "[FONTS] Instaluji Noto Mono font pro Unicode podporu..." | tee -a "$LOG_FILE"
sudo apt install -y fonts-noto-mono | tee -a "$LOG_FILE"

# 3a. Instalace Gnome Terminal pro lepší Unicode podporu
echo "[TERMINAL] Instaluji Gnome Terminal pro lepší Unicode podporu..." | tee -a "$LOG_FILE"
sudo apt install -y gnome-terminal | tee -a "$LOG_FILE"

# 3b. Konfigurace plochy pro uživatele remotes
echo "[DESKTOP] === DEBUG: Spouštím konfiguraci plochy ===" | tee -a "$LOG_FILE"
echo "[DESKTOP] Script verze: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
DESKTOP_DIR="/home/remotes/Desktop"
mkdir -p "$DESKTOP_DIR"

# Debug: zobraz aktuální obsah plochy
echo "[DESKTOP] DEBUG: Aktuální soubory na ploše:" | tee -a "$LOG_FILE"
ls -la "$DESKTOP_DIR"/*.desktop 2>/dev/null | tee -a "$LOG_FILE" || echo "Žádné .desktop soubory nenalezeny" | tee -a "$LOG_FILE"

# Odstranění starých zástupců terminálu
echo "[DESKTOP] Odstraňuji staré zástupce terminálu..." | tee -a "$LOG_FILE"
echo "[DESKTOP] DEBUG: Mazání souborů:" | tee -a "$LOG_FILE"
find "$DESKTOP_DIR" -name "*terminal*.desktop" -exec echo "  Mažu: {}" \; -delete | tee -a "$LOG_FILE"
find "$DESKTOP_DIR" -name "*Terminal*.desktop" -exec echo "  Mažu: {}" \; -delete | tee -a "$LOG_FILE"
find "$DESKTOP_DIR" -name "xfce4-terminal*.desktop" -exec echo "  Mažu: {}" \; -delete | tee -a "$LOG_FILE"

echo "[DESKTOP] DEBUG: Obsah plochy po smazání:" | tee -a "$LOG_FILE"
ls -la "$DESKTOP_DIR"/*.desktop 2>/dev/null | tee -a "$LOG_FILE" || echo "Žádné .desktop soubory nezůstaly" | tee -a "$LOG_FILE"

# Vytvoření nového zástupce Gnome Terminal
echo "[DESKTOP] Vytvářím nový zástupce Gnome Terminal..." | tee -a "$LOG_FILE"
cat > "$DESKTOP_DIR/gnome-terminal.desktop" << 'EOF'
[Desktop Entry]
Version=1.0
Name=Terminal
Comment=Use the command line
TryExec=gnome-terminal
Exec=gnome-terminal --disable-factory
Icon=utilities-terminal
Type=Application
Categories=System;TerminalEmulator;
StartupNotify=true
Keywords=shell;prompt;command;commandline;cmd;
EOF

# Nastavení oprávnění a vlastníka
chmod +x "$DESKTOP_DIR/gnome-terminal.desktop"
chown remotes:remotes "$DESKTOP_DIR/gnome-terminal.desktop"

# Označit jako trusted pro desktop environment
echo "[DESKTOP] Označuji zástupce jako trusted..." | tee -a "$LOG_FILE"
gio set "$DESKTOP_DIR/gnome-terminal.desktop" metadata::trusted true 2>/dev/null || echo "[DESKTOP] gio set selhalo - pokračuji..." | tee -a "$LOG_FILE"

# Refresh font cache pro okamžité použití nových fontů
echo "[FONTS] Aktualizuji font cache..." | tee -a "$LOG_FILE"
fc-cache -f -v | tee -a "$LOG_FILE" || echo "[FONTS] Font cache refresh selhal - pokračuji..." | tee -a "$LOG_FILE"

echo "[DESKTOP] DEBUG: Finální obsah plochy:" | tee -a "$LOG_FILE"
ls -la "$DESKTOP_DIR"/*.desktop 2>/dev/null | tee -a "$LOG_FILE" || echo "Žádné .desktop soubory" | tee -a "$LOG_FILE"
echo "[DESKTOP] === DEBUG: Konfigurace plochy dokončena ===" | tee -a "$LOG_FILE"

# Kontrola že Gnome Terminal je nainstalován
echo "[DESKTOP] DEBUG: Kontrola instalace Gnome Terminal:" | tee -a "$LOG_FILE"
which gnome-terminal | tee -a "$LOG_FILE" || echo "Gnome Terminal NENÍ nainstalován!" | tee -a "$LOG_FILE"

# 4. Odstranění nepoužívaných balíků
echo "[CLEANUP] Odstraňuji nepotřebné balíky..."
sudo apt autoremove -y

# 5. Zajištění automatického spuštění Syncthingu
echo "[SYNCTHING] Povoluji autospuštění Syncthingu..." | tee -a "$LOG_FILE"
systemctl --user enable syncthing | tee -a "$LOG_FILE"
sudo loginctl enable-linger "$USER" | tee -a "$LOG_FILE"

# 5a. Konfigurace Syncthing API klíče
echo "[SYNCTHING] Kontroluji konfiguraci API klíče..." | tee -a "$LOG_FILE"
if [ -z "$SYNCTHING_API_KEY" ]; then
    echo "[SYNCTHING] SYNCTHING_API_KEY není nastaven - vyžaduje interaktivní konfiguraci" | tee -a "$LOG_FILE"
    echo ""
    echo "=============================================="
    echo "SYNCTHING API KEY SETUP"
    echo "=============================================="
    echo "1. Otevřete Syncthing UI: http://127.0.0.1:8384"
    echo "2. Jděte do Settings → General → API Key"
    echo "3. Zkopírujte API klíč"
    echo ""
    read -p "Vložte Syncthing API klíč: " api_key
    
    if [ -n "$api_key" ]; then
        echo "[SYNCTHING] Ukládám API klíč do ~/.bashrc..." | tee -a "$LOG_FILE"
        echo "" >> ~/.bashrc
        echo "# Syncthing API Key pro sys-update script" >> ~/.bashrc
        echo "export SYNCTHING_API_KEY=\"$api_key\"" >> ~/.bashrc
        echo "[SYNCTHING] API klíč uložen. Aktivuji pro aktuální session..." | tee -a "$LOG_FILE"
        export SYNCTHING_API_KEY="$api_key"
    else
        echo "[SYNCTHING] Prázdný API klíč - přeskakuji rescan" | tee -a "$LOG_FILE"
    fi
else
    echo "[SYNCTHING] API klíč je již nastaven - přeskakuji konfiguraci" | tee -a "$LOG_FILE"
    echo "[SYNCTHING] Pokud rescan nefunguje, zkontrolujte: echo \$SYNCTHING_API_KEY" | tee -a "$LOG_FILE"
fi

# 5b. Trigger Syncthing rescan pro rychlejší synchronizaci
if [ -n "$SYNCTHING_API_KEY" ]; then
    echo "[SYNCTHING] Spouštím rescan složky Sync..." | tee -a "$LOG_FILE"
    curl -X POST -H "X-API-Key: $SYNCTHING_API_KEY" \
         "http://127.0.0.1:8384/rest/db/scan?folder=fyosb-qvffe" 2>/dev/null | tee -a "$LOG_FILE" || echo "[SYNCTHING] Rescan selhal - pokračuji..." | tee -a "$LOG_FILE"
else
    echo "[SYNCTHING] API klíč není dostupný - přeskakuji rescan" | tee -a "$LOG_FILE"
fi

# 6. Restart systému
echo "[REBOOT] Restart systému za 10 vteřin (stiskni Ctrl+C pro zrušení)..." | tee -a "$LOG_FILE"
sleep 10
sudo reboot
