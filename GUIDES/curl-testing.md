# CURL Testing Guide - Webové Rozhraní IVY

## Kompletní CURL testování s přihlášením

### KROK 1 - PŘIHLÁŠENÍ
```bash
# Získej heslo z databáze
HESLO=$(mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" ivy -se "SELECT value FROM variables WHERE name='web_pass_A'")

# Přihlášení a uložení cookies
curl -c test-cookies.log -d "password=$HESLO" -X POST "https://ivy.zdendys79.website/login"
```

### KROK 2 - TESTOVÁNÍ STRÁNEK
```bash
# Základní test stránky
curl -b test-cookies.log -s "https://ivy.zdendys79.website/action-log/user?user_id=43"

# Test s náhledem prvních 20 řádků
curl -b test-cookies.log -s "https://ivy.zdendys79.website/cesta" | head -20

# Podrobný test s hlavičkami pro debugging
curl -b test-cookies.log -v "https://ivy.zdendys79.website/cesta"
```

## DŮLEŽITÉ DETAILY

### Cookie Management
- **Cookie soubor:** `test-cookies.log` (*.log jsou v .gitignore - nebude commitován)
- **Session:** PHPSESSID cookie platí 30 dní
- **Test bez cookies NEFUNGUJE!** - vždy vrací redirect na /login

### Ověření Úspěchu
- **Úspěch:** Vrací HTML hlavní menu
- **Chyba:** Redirect na /login stránku
- **PHP chyby:** Kontroluj error logy

### Databázové Informace
- **Heslo:** Z `ivy.variables` WHERE `name='web_pass_A'`
- **Struktura projektu:** Webové soubory (~/ivy4b3t/web/) se projevují okamžitě

## POSTUP PRO DETEKCI CHYB

1. **Curl test s přihlášením**
2. **Kontrola HTML výstupu vs. chybové hlášky**
3. **Oprava SQL/PHP chyb na základě error messages**
4. **Zopakování testu**

## DATABÁZOVÉ POZORNOSTI

- Sloupec `email` = skutečně `e_mail` v tabulce fb_users
- Tabulka quotes: `text` neexistuje → použít `translated_text` nebo `original_text`
- MariaDB nepodporuje LIMIT v subquery s IN - použít jednoduchý LIMIT
- **VŽDY použít DESCRIBE TABLE před psaním SQL dotazů!**