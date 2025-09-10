# Troubleshooting Guide - Logs & Debugging

## LOG SOUBORY A MONITOROVÁNÍ

### PHP Chybové logy
- **Cesta:** `/home/remotes/ivy4b3t/web/logs/php_errors.log`
- **Stav:** `log_errors = On`
- **Oprávnění:** `0644`
- **Zobrazování:** `display_errors = Off` (správně pro produkci)

### Apache logy
- **Adresář:** `/var/log/apache2/`
- **Konkrétní soubory:**
  - Error log: `/var/log/apache2/ivy.zdendys.website_error.log`
  - Access log: `/var/log/apache2/ivy.zdendys.website_access.log`

## PŘÍKAZY PRO MONITORING

```bash
# PHP chyby
tail -f /home/remotes/ivy4b3t/web/logs/php_errors.log

# Apache chyby
tail -f /var/log/apache2/ivy.zdendys.website_error.log

# Apache přístupy
tail -f /var/log/apache2/ivy.zdendys.website_access.log

# RSS system logy
tail -f /tmp/ivy_rss.log

# System logy
journalctl -f -u apache2
```

## POZNÁMKY

- **PHP logy:** V projektu (`~/ivy4b3t/web/logs/`)
- **Apache logy:** V systémové složce (`/var/log/apache2/`)
- **RSS logy:** V temp složce (`/tmp/`)

## Debugging Workflow

1. **Identifikace problému** - z error logs nebo uživatelské zprávy
2. **Lokalizace kódu** - použití grep/glob pro nalezení relevantního souboru
3. **Analýza** - čtení kontextu pomocí Read tool
4. **Testování** - CURL test pro web komponenty
5. **Oprava** - minimální změna kódu
6. **Ověření** - opakování testů

## Časté problémy

### Web Interface
- **403/404 chyby:** Zkontrolovat Apache error log
- **PHP chyby:** Zkontrolovat PHP error log
- **Přihlášení nefunguje:** Zkontrolovat session a cookies
- **SQL chyby:** DESCRIBE table před použitím

### IVY Application
- **Display problémy:** Zkontrolovat DISPLAY=:20 nastavení
- **Module chyby:** Zkontrolovat npm dependencies v ivy/
- **Database connection:** Ověřit MYSQL_ environment variables

### RSS System
- **Staré články:** Zkontrolovat cron job
- **Nedostupné URL:** Spustit RSS server ručně
- **Database chyby:** Zkontrolovat MYSQL_ proměnné