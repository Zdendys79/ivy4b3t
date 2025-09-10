# RSS System Guide - News Post Actions

## Přehled RSS systému

- **Lokace:** `/home/remotes/ivy4b3t/rss-server/`
- **Hlavní skript:** `rss-standalone.js`
- **Účel:** Načítá RSS feeds z českých zpravodajských serverů do databáze
- **Databázové tabulky:** `rss_channels`, `rss_urls`
- **Datová závislost:** `news_post` akce potřebují čerstvé URL (max 7 dní staré)

## Systémové proměnné

RSS server používá standardní MYSQL_ proměnné (NEJSOU potřeba DB_ proměnné):
- `MYSQL_HOST` - adresa databáze
- `MYSQL_USER` - uživatelské jméno
- `MYSQL_PASSWORD` - heslo
- `MYSQL_DATABASE` - název databáze (ivy/ivy_test se určí automaticky)

## Automatické spouštění (CRON)

```bash
# Nastavení automatického RSS cron jobu (každých 15 minut)
cd /home/remotes/ivy4b3t/scripts
./setup_rss_cron.sh

# Ruční spuštění RSS serveru
cd /home/remotes/ivy4b3t/rss-server
node rss-standalone.js
```

## RSS zdroje (aktivní kanály)

1. **iDNES.cz** - https://servis.idnes.cz/rss.aspx?c=zpravodaj
2. **Novinky.cz** - https://www.novinky.cz/rss  
3. **Aktuálně.cz** - https://www.aktualne.cz/rss/
4. **ČT24** - https://ct24.ceskatelevize.cz/rss/hlavni-zpravy

## Logování a monitoring

- **CRON logy:** `/tmp/ivy_rss.log`
- **Kontrola dostupnosti:** `SELECT COUNT(*) FROM rss_urls WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
- **Poslední běh:** `SELECT MAX(last_fetched) FROM rss_channels`

## Řešení problémů

- **"Žádná dostupná RSS URL"** → RSS server neběžel ≥7 dní, spustit ručně
- **Staré články** → Zkontrolovat cron job: `crontab -l | grep rss`
- **DB chyby** → Ověřit MYSQL_ systémové proměnné

## Monitoring příkazy

```bash
# Zkontrolovat cron job
crontab -l | grep rss

# Sledovat RSS logy
tail -f /tmp/ivy_rss.log

# Test ručního spuštění
cd /home/remotes/ivy4b3t/rss-server && node rss-standalone.js
```