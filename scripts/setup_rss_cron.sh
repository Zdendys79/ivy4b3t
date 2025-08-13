#!/bin/bash
# setup_rss_cron.sh
# Nastavení cron job pro automatické spouštění RSS serveru každých 15 minut

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RSS_SCRIPT="/home/remotes/ivy4b3t/rss-server/rss-standalone.js"

echo "Nastavuji cron job pro automatické RSS zpracování..."
echo "RSS skript: $RSS_SCRIPT"

# Kontrola existence RSS skriptu
if [ ! -f "$RSS_SCRIPT" ]; then
    echo "CHYBA: RSS skript nenalezen: $RSS_SCRIPT"
    exit 1
fi

# Udělej RSS skript spustitelný
chmod +x "$RSS_SCRIPT"

# Vytvoř cron job záznam - každých 15 minut
CRON_JOB="*/15 * * * * cd /home/remotes/ivy4b3t/rss-server && node rss-standalone.js >> /tmp/ivy_rss.log 2>&1"

# Zkontroluj, zda cron job již neexistuje
if crontab -l 2>/dev/null | grep -q "rss-standalone.js"; then
    echo "Cron job pro RSS skript již existuje."
    echo "Aktuální crontab:"
    crontab -l | grep "rss-standalone.js"
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
echo "RSS server bude spouštěn každých 15 minut"
echo "Logy jsou zapisovány do: /tmp/ivy_rss.log"
echo ""
echo "Pro ručné spuštění použij: cd /home/remotes/ivy4b3t/rss-server && node rss-standalone.js"
echo "Pro zobrazení logů použij: tail -f /tmp/ivy_rss.log"
echo ""
echo "DŮLEŽITÉ: RSS server používá systémové proměnné MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE"
echo "Ujisti se, že jsou tyto proměnné nastaveny v prostředí, kde cron běží."