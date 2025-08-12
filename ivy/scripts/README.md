# IVY Scripts Directory

Tato složka obsahuje všechny skripty specifické pro IVY aplikaci a databázi.

## Struktura

### Databázové skripty
- `compact_group_ids.sh` - Kompaktování ID v fb_groups tabulce
- `db_backup.sh` - Zálohování IVY databáze
- `test-db-connection.sh` - Test připojení k databázi

### SQL migrace a opravy
- `migrate_*.sql` - Migrační skripty pro databázové změny
- `fix_*.sql` - Opravné skripty pro databázová data
- `create_*.sql` - Skripty pro vytváření nových struktur
- `sql/` - Podložka s SQL skripty pro tabulky

### Testovací skripty
- `test_*.js` - JavaScript testovací skripty
- `utf8-test.sh` - Test UTF-8 kódování
- `backfill_group_keywords.js` - Doplnění chybějících klíčových slov

### Utility skripty  
- `enhanced-password-generator.js` - Generátor silných hesel
- `quotes-google-sheets.js` - Import citátů z Google Sheets
- `run_*.sh` - Spouštěcí skripty pro různé operace

### Dokumentace
- `README-translation-checker.md` - Dokumentace pro překlad checker

## Použití

Všechny skripty jsou určené pro práci s IVY databází a aplikací. Před spuštěním se ujistěte, že máte nastavené správné environment variables:

```bash
export MYSQL_HOST="..."
export MYSQL_USER="..."
export MYSQL_PASSWORD="..."
export MYSQL_DATABASE="ivy"  # nebo "ivy_test"
```

## Poznámky

- Skripty v nadřazené složce `~/scripts/` jsou systémové (sudo operace)
- Všechny ivy-specific skripty jsou zde pro lepší organizaci
- Před spuštěním migračních skriptů vždy zálohujte databázi