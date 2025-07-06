#!/bin/bash
# setup_backup_cron.sh
# Nastavení cron job pro automatické zálohování každých 6 hodin

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/db_backup.sh"

echo "Nastavuji cron job pro automatické zálohování databáze..."
echo "Backup skript: $BACKUP_SCRIPT"

# Kontrola existence backup skriptu
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "CHYBA: Backup skript nenalezen: $BACKUP_SCRIPT"
    exit 1
fi

# Udělej backup skript spustitelný
chmod +x "$BACKUP_SCRIPT"

# Vytvoř cron job záznam
CRON_JOB="0 */6 * * * $BACKUP_SCRIPT >> /tmp/ivy_backup.log 2>&1"

# Zkontroluj, zda cron job již neexistuje
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo "Cron job pro backup skript již existuje."
    echo "Aktuální crontab:"
    crontab -l | grep "$BACKUP_SCRIPT"
else
    # Přidej nový cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Cron job přidán:"
    echo "$CRON_JOB"
fi

echo ""
echo "Aktuální crontab pro uživatele $(whoami):"
crontab -l

echo ""
echo "Zálohy budou spouštěny každých 6 hodin (00:00, 06:00, 12:00, 18:00)"
echo "Logy jsou zapisovány do: /tmp/ivy_backup.log"
echo ""
echo "Pro ručné spuštění použij: $BACKUP_SCRIPT"
echo "Pro zobrazení logů použij: tail -f /tmp/ivy_backup.log"