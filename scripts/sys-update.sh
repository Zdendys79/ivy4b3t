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

# 2. Nastavení UTC času před aktualizací
echo "[TIME] Nastavuji systémový čas na UTC..." | tee -a "$LOG_FILE"
sudo timedatectl set-timezone UTC
sudo timedatectl set-ntp true
sudo systemctl restart systemd-timesyncd
sleep 2
echo "[TIME] ✅ Čas nastaven na UTC: $(date -u)" | tee -a "$LOG_FILE"

# 3. Aktualizace systému včetně phased balíků
echo "[UPDATE] Spouštím plnou aktualizaci včetně phased updates..." | tee -a "$LOG_FILE"
sudo apt-get -o APT::Get::Always-Include-Phased-Updates=true update | tee -a "$LOG_FILE"
sudo apt-get -o APT::Get::Always-Include-Phased-Updates=true upgrade -y | tee -a "$LOG_FILE"

# 4. Instalace Noto fontů pro Unicode a emoji podporu v terminálu
echo "[FONTS] Instaluji Noto fonty pro Unicode a emoji podporu..." | tee -a "$LOG_FILE"
sudo apt-get install -y fonts-noto-mono fonts-noto-color-emoji | tee -a "$LOG_FILE"

# Refresh font cache pro okamžité použití nových fontů
echo "[FONTS] Čistím poškozené font cache soubory..." | tee -a "$LOG_FILE"
rm -f ~/.cache/fontconfig/*.cache-9 2>/dev/null || true

echo "[FONTS] Aktualizuji font cache..." | tee -a "$LOG_FILE"
fc-cache -f -v | tee -a "$LOG_FILE" || echo "[FONTS] Font cache refresh selhal - pokračuji..." | tee -a "$LOG_FILE"

# 4a. Potlačení color management authentication výzev
echo "[POLKIT] Potlačuji authentication výzvy pro color management..." | tee -a "$LOG_FILE"
sudo tee /etc/polkit-1/localauthority/50-local.d/45-allow-colord.pkla > /dev/null <<EOF
[Allow Colord all Users]
Identity=unix-user:*
Action=org.freedesktop.color-manager.create-device;org.freedesktop.color-manager.create-profile;org.freedesktop.color-manager.delete-device;org.freedesktop.color-manager.delete-profile;org.freedesktop.color-manager.modify-device;org.freedesktop.color-manager.modify-profile
ResultAny=no
ResultInactive=no
ResultActive=yes
EOF
echo "[POLKIT] ✅ Color management authentication výzvy potlačeny" | tee -a "$LOG_FILE"

# 4. Odstranění nepoužívaných balíků
echo "[CLEANUP] Odstraňuji nepotřebné balíky..."
sudo apt-get autoremove -y

# 4a. Aktualizace Syncthing na verzi 2.x
echo "[SYNCTHING] Instaluji/aktualizuji Syncthing na verzi 2.x..." | tee -a "$LOG_FILE"

# 4a.1 Přidání oficiálního Syncthing v2 repository
echo "[SYNCTHING] Přidávám oficiální Syncthing v2 repository..." | tee -a "$LOG_FILE"
sudo mkdir -p /etc/apt/keyrings
sudo curl -L -o /etc/apt/keyrings/syncthing-archive-keyring.gpg https://syncthing.net/release-key.gpg | tee -a "$LOG_FILE"
echo "deb [signed-by=/etc/apt/keyrings/syncthing-archive-keyring.gpg] https://apt.syncthing.net/ syncthing stable-v2" | sudo tee /etc/apt/sources.list.d/syncthing.list | tee -a "$LOG_FILE"

# 4a.2 Nastavení repository priority
echo "[SYNCTHING] Nastavuji prioritu Syncthing repository..." | tee -a "$LOG_FILE"
printf "Package: *\nPin: origin apt.syncthing.net\nPin-Priority: 990\n" | sudo tee /etc/apt/preferences.d/syncthing.pref | tee -a "$LOG_FILE"

# 4a.3 Instalace/aktualizace Syncthing v2.x
echo "[SYNCTHING] Aktualizuji APT cache a instaluji Syncthing v2.x..." | tee -a "$LOG_FILE"
sudo apt-get update | tee -a "$LOG_FILE"
sudo apt-get install -y syncthing | tee -a "$LOG_FILE"

# 4a.4 Kontrola úspěšné instalace
if command -v syncthing >/dev/null 2>&1; then
    SYNCTHING_VERSION=$(syncthing version | head -n1)
    echo "[SYNCTHING] ✅ Úspěšně nainstalováno: $SYNCTHING_VERSION" | tee -a "$LOG_FILE"
    
    if [[ $SYNCTHING_VERSION == *"v2."* ]]; then
        echo "[SYNCTHING] ✅ Potvrzena verze 2.x" | tee -a "$LOG_FILE"
    else
        echo "[SYNCTHING] ⚠️ Varování: Verze neobsahuje 'v2.' - zkontrolujte instalaci" | tee -a "$LOG_FILE"
    fi
else
    echo "[SYNCTHING] ❌ Chyba: Syncthing není dostupný po instalaci" | tee -a "$LOG_FILE"
fi

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

# 6. Oprava oprávnění log souboru před restartem
echo "[CLEANUP] Opravuji oprávnění log souboru..." | tee -a "$LOG_FILE"
sudo chown "$USER:$USER" "$LOG_FILE"
sudo chmod 664 "$LOG_FILE"

# 7. Restart systému
echo "[REBOOT] Restart systému za 10 vteřin (stiskni Ctrl+C pro zrušení)..." | tee -a "$LOG_FILE"
sleep 10
sudo reboot
