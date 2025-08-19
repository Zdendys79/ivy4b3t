#!/bin/bash

# update-syncthing-v2.sh
# Aktualizace Syncthing na verzi 2.x z oficiálních stránek

# === LOGGING SETUP ===
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/syncthing-update-$(hostname).txt"
echo "=== SYNCTHING v2 UPDATE SCRIPT START ===" | tee "$LOG_FILE"
echo "Datum: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "Hostname: $(hostname)" | tee -a "$LOG_FILE"
echo "User: $(whoami)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# Kontrola aktuální verze Syncthingu
echo "[INFO] Kontroluji aktuální verzi Syncthingu..." | tee -a "$LOG_FILE"
if command -v syncthing >/dev/null 2>&1; then
    current_version=$(syncthing --version | head -n1)
    echo "[INFO] Aktuální verze: $current_version" | tee -a "$LOG_FILE"
else
    echo "[INFO] Syncthing není nainstalován" | tee -a "$LOG_FILE"
fi

# Zastavení Syncthingu před aktualizací
echo "[STOP] Zastavuji Syncthing service..." | tee -a "$LOG_FILE"
systemctl --user stop syncthing 2>/dev/null || echo "[INFO] Syncthing user service není spuštěn" | tee -a "$LOG_FILE"

# 1. Přidání oficiálního klíče Syncthing
echo "[KEYS] Přidávám oficiální Syncthing release key..." | tee -a "$LOG_FILE"
sudo mkdir -p /etc/apt/keyrings
sudo curl -L -o /etc/apt/keyrings/syncthing-archive-keyring.gpg https://syncthing.net/release-key.gpg

if [ $? -eq 0 ]; then
    echo "[KEYS] ✅ Release key úspěšně stažen" | tee -a "$LOG_FILE"
else
    echo "[ERROR] ❌ Stažení release key selhalo" | tee -a "$LOG_FILE"
    exit 1
fi

# 2. Přidání oficiálního stable-v2 repository
echo "[REPO] Přidávám oficiální Syncthing stable-v2 repository..." | tee -a "$LOG_FILE"
echo "deb [signed-by=/etc/apt/keyrings/syncthing-archive-keyring.gpg] https://apt.syncthing.net/ syncthing stable-v2" | sudo tee /etc/apt/sources.list.d/syncthing.list

# 3. Nastavení repository priority (volitelné, ale doporučené)
echo "[REPO] Nastavuji prioritu Syncthing repository..." | tee -a "$LOG_FILE"
printf "Package: *\nPin: origin apt.syncthing.net\nPin-Priority: 990\n" | sudo tee /etc/apt/preferences.d/syncthing.pref

# 4. Aktualizace APT cache
echo "[UPDATE] Aktualizuji APT cache..." | tee -a "$LOG_FILE"
sudo apt-get update

# 5. Instalace/aktualizace Syncthing
echo "[INSTALL] Instaluji/aktualizuji Syncthing na verzi 2.x..." | tee -a "$LOG_FILE"
sudo apt-get install -y syncthing

if [ $? -eq 0 ]; then
    echo "[INSTALL] ✅ Syncthing úspěšně nainstalován/aktualizován" | tee -a "$LOG_FILE"
else
    echo "[ERROR] ❌ Instalace/aktualizace Syncthingu selhala" | tee -a "$LOG_FILE"
    exit 1
fi

# 6. Kontrola nové verze
echo "[INFO] Kontroluji novou verzi Syncthingu..." | tee -a "$LOG_FILE"
if command -v syncthing >/dev/null 2>&1; then
    new_version=$(syncthing --version | head -n1)
    echo "[INFO] Nová verze: $new_version" | tee -a "$LOG_FILE"
    
    if [[ $new_version == *"v2."* ]]; then
        echo "[SUCCESS] ✅ Syncthing byl úspěšně aktualizován na verzi 2.x" | tee -a "$LOG_FILE"
    else
        echo "[WARNING] ⚠️ Verze neobsahuje 'v2.' - zkontrolujte instalaci" | tee -a "$LOG_FILE"
    fi
else
    echo "[ERROR] ❌ Syncthing není dostupný po instalaci" | tee -a "$LOG_FILE"
    exit 1
fi

# 7. Povolení automatického spuštění
echo "[SERVICE] Povoluji automatické spuštění Syncthingu..." | tee -a "$LOG_FILE"
systemctl --user enable syncthing
sudo loginctl enable-linger "$USER"

# 8. Spuštění Syncthing service
echo "[SERVICE] Spouštím Syncthing service..." | tee -a "$LOG_FILE"
systemctl --user start syncthing

# Čekání na spuštění a kontrola stavu
sleep 3
if systemctl --user is-active --quiet syncthing; then
    echo "[SERVICE] ✅ Syncthing service je aktivní" | tee -a "$LOG_FILE"
    echo "[INFO] Web UI dostupné na: http://127.0.0.1:8384" | tee -a "$LOG_FILE"
else
    echo "[WARNING] ⚠️ Syncthing service se nespustil - zkontrolujte manuálně" | tee -a "$LOG_FILE"
    echo "[INFO] Pro kontrola použijte: systemctl --user status syncthing" | tee -a "$LOG_FILE"
fi

echo "[SUCCESS] 🎉 Aktualizace Syncthingu na verzi 2.x dokončena!" | tee -a "$LOG_FILE"
echo "[INFO] Pro kontrolu migrace databáze zkontrolujte logy: journalctl --user -u syncthing -f" | tee -a "$LOG_FILE"