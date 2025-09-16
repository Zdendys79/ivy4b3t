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

# Načti databázové proměnné ze systému
if [ -z "$MYSQL_HOST" ] || [ -z "$MYSQL_USER" ] || [ -z "$MYSQL_PASSWORD" ]; then
    echo "⚠️ VAROVÁNÍ: Databázové proměnné nejsou nastaveny!"
    echo "Nastavte: export MYSQL_HOST=... MYSQL_USER=... MYSQL_PASSWORD=... MYSQL_DATABASE=..."
    echo "Pokračuji, ale cron job nebude fungovat bez těchto proměnných!"
fi

# Vytvoř cron job záznam s environment variables - každých 15 minut
CRON_JOB="*/15 * * * * MYSQL_HOST='$MYSQL_HOST' MYSQL_PORT='$MYSQL_PORT' MYSQL_USER='$MYSQL_USER' MYSQL_PASSWORD='$MYSQL_PASSWORD' MYSQL_DATABASE='$MYSQL_DATABASE' cd /home/remotes/ivy4b3t/rss-server && node rss-standalone.js >> /tmp/ivy_rss.log 2>&1"

# Odstraň starý cron job pokud existuje (bez environment variables)
if crontab -l 2>/dev/null | grep -q "rss-standalone.js"; then
    echo "Odstraňuji starý cron job..."
    # Odstraň všechny řádky obsahující rss-standalone.js
    (crontab -l 2>/dev/null | grep -v "rss-standalone.js") | crontab -
fi

# Přidej nový cron job s environment variables
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
echo "✅ Cron job přidán s databázovými proměnnými"

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