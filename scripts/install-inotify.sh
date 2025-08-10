#!/bin/bash

# install-inotify.sh - Instalace inotify-tools + automatické spouštění při startu systému

SERVICE_FILE="/etc/systemd/system/scripts-sync.service"

echo "📦 Instaluji inotify-tools a nastavuji automatické spouštění..."

# Nastavení UTC času
echo "⏰ Nastavuji UTC čas před instalací..."
sudo timedatectl set-timezone UTC
sudo timedatectl set-ntp true
sudo systemctl restart systemd-timesyncd
sleep 2
echo "✅ Čas nastaven na UTC: $(date -u)"

# Instalace inotify-tools
if ! command -v inotifywait &> /dev/null; then
    echo "🔧 Instaluji inotify-tools..."
    sudo apt update && sudo apt install -y inotify-tools
    echo "✅ inotify-tools nainstalováno"
else
    echo "✅ inotify-tools je už nainstalováno"
fi

# Vytvoření systemd service
echo "🔧 Vytvářím systemd service..."

sudo tee /etc/systemd/system/scripts-sync.service > /dev/null << 'SERVICEEOF'
[Unit]
Description=Scripts Sync Watcher
After=network.target

[Service]
Type=simple
User=remotes
WorkingDirectory=/home/remotes/ivy4b3t
ExecStartPre=/usr/bin/rsync -av /home/remotes/ivy4b3t/scripts/ /home/remotes/Sync/scripts/
ExecStart=/bin/bash -c 'echo "🔍 Spouštím sledování změn ve složce /home/remotes/ivy4b3t/scripts/"; inotifywait -m -r -e modify,create,delete,move /home/remotes/ivy4b3t/scripts/ --format "%%w%%f %%e" | while read file event; do if [[ "$file" != *".tmp" ]] && [[ "$file" != *"~" ]] && [[ "$file" != *".swp" ]]; then echo "🔄 $(date "+%%H:%%M:%%S") - Změna: $file ($event)"; rsync -a /home/remotes/ivy4b3t/scripts/ /home/remotes/Sync/scripts/ && echo "✅ $(date "+%%H:%%M:%%S") - Synchronizace dokončena"; fi; done'
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Povolit a spustit service
echo "🔧 Aktivuji a spouštím service..."
sudo systemctl daemon-reload
sudo systemctl enable scripts-sync.service
sudo systemctl start scripts-sync.service

# Zkontrolovat stav
echo "📊 Stav služby:"
sudo systemctl status scripts-sync.service --no-pager

echo ""
echo "✅ Instalace dokončena! Sledování běží automaticky."
echo ""
echo "🔍 Kontrola stavu: sudo systemctl status scripts-sync.service"
echo "🛑 Zastavení: sudo systemctl stop scripts-sync.service"
echo "📜 Logy: sudo journalctl -u scripts-sync.service -f"
echo ""
echo "📊 TEST FUNGOVÁNÍ:"
echo "   1. Vytvoř testovací soubor: touch /home/remotes/ivy4b3t/scripts/test.txt"
echo "   2. Sleduj logy: sudo journalctl -u scripts-sync.service -f"
echo "   3. Měl bys vidět: '🔄 Změna: test.txt (CREATE)' a '✅ Synchronizace dokončena'"
echo "   4. Smaž test: rm /home/remotes/ivy4b3t/scripts/test.txt"