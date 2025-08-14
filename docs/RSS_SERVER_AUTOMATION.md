# RSS Server Automation Guide

## Přehled
RSS server pro IVY4B3T projekt je plně automatizovaný systém pro pravidelné stahování a zpracování RSS feedů. Běží nezávisle na hlavní aplikaci prostřednictvím cron jobs.

## Automatické spouštění

### Cron Job Konfigurace
RSS server se automaticky spouští každých **15 minut** prostřednictvím cron job:

```bash
*/15 * * * * cd /home/remotes/ivy4b3t/rss-server && node rss-standalone.js >> /tmp/ivy_rss.log 2>&1
```

### Setup Cron Job
Pro nastavení automatického spouštění použij setup skript:

```bash
cd /home/remotes/ivy4b3t/scripts
./setup_rss_cron.sh
```

Skript automaticky:
- Zkontroluje existenci RSS serveru
- Nastaví oprávnění
- Přidá cron job (pokud neexistuje)
- Zobrazí aktuální konfiguraci

## Systémové proměnné

RSS server používá stejné **MYSQL_** systémové proměnné jako hlavní aplikace:

- `$MYSQL_HOST` - adresa databázového serveru
- `$MYSQL_USER` - uživatelské jméno
- `$MYSQL_PASSWORD` - heslo
- `$MYSQL_DATABASE` - název databáze

**DŮLEŽITÉ:** Systém automaticky vybírá správnou databázi podle aktuální větve:
- `ivy` - produkční větev
- `ivy_test` - vývojová/testovací větev

## Monitorování

### Log soubory
RSS server zapisuje logy do:
```bash
/tmp/ivy_rss.log
```

### Zobrazení logů
```bash
# Sledování v reálném čase
tail -f /tmp/ivy_rss.log

# Posledních 50 záznamů
tail -50 /tmp/ivy_rss.log

# Hledání chyb
grep ERROR /tmp/ivy_rss.log
```

### Ověření cron job
```bash
# Zobrazit všechny cron jobs
crontab -l

# Ověřit RSS cron job
crontab -l | grep rss-standalone
```

## Ruční spuštění

### Testovací spuštění
```bash
cd /home/remotes/ivy4b3t/rss-server
node rss-standalone.js
```

### Debug spuštění s detailními logy
```bash
cd /home/remotes/ivy4b3t/rss-server
DEBUG=true node rss-standalone.js
```

## Funkce RSS serveru

### Co RSS server dělá
1. **Stahuje RSS feedy** z aktivních kanálů (round-robin)
2. **Ukládá URL článků** do databáze (`rss_urls` tabulka)
3. **Synchronizuje** mezi prod a test databázemi
4. **Čistí staré URL** (starší 2 dnů nebo použité)
5. **Poskytuje statistiky** o zpracovaných URL

### Databázové tabulky
- `rss_channels` - konfigurace RSS kanálů
- `rss_urls` - úložiště URL článků

### Výstup zpracování
RSS server při každém běhu zobrazuje:
- Počet nových URL
- Počet duplicitních URL  
- Počet vyčištěných starých URL
- Celkové statistiky databáze
- Čas zpracování

## Řešení problémů

### RSS server neběží
```bash
# Zkontrolovat cron service
sudo systemctl status cron

# Restartovat cron service
sudo systemctl restart cron

# Zkontrolovat cron logy
grep CRON /var/log/syslog
```

### Chyby v databázi
```bash
# Zkontrolovat připojení k databázi
mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1"

# Zkontrolovat tabulky RSS
mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SHOW TABLES LIKE 'rss_%'"
```

### Nedostatek RSS URL
```bash
# Zkontrolovat počet dostupných URL
mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) as unused FROM rss_urls WHERE used_count = 0"

# Ručně spustit RSS server
cd /home/remotes/ivy4b3t/rss-server && node rss-standalone.js
```

## Výkon a optimalizace

### Frekvence spouštění
- **Aktuálně:** každých 15 minut
- **Doporučení:** Upravit podle potřeby v cron job

### Kapacita databáze
- RSS server čistí URL starší 2 dnů
- Používané URL se odstraní po 1 dni od použití
- Každý kanál se zpracovává round-robin způsobem

### Monitoring výkonu
RSS server poskytuje metriky:
- Čas zpracování
- Počet zpracovaných URL
- Statistiky databáze
- Success/error rate

---
*Aktualizováno: 2025-08-13*
*Verze: 1.0*