# Database Migration Strategy - ivy_test → ivy

## Přehled

Tento dokument definuje migrační strategie pro synchronizaci databáze `ivy_test` (vývojová) s databází `ivy` (produkční).

## Kategorie tabulek

### 🔒 SYNCHRONNÍ OBSAH - Zachovat produkční data
**Tabulky s kritickými produkčními daty - NIKDY nepřepisovat:**

- `fb_users` - produkční uživatelské účty
- `fb_groups` - skupiny s produkční historií postování  
- `action_log` - historie všech akcí v produkci
- `user_groups` - vazby uživatelů na skupiny
- `group_word_associations` - asociace klíčových slov skupin
- `group_keywords` - klíčová slova skupin
- `user_action_plan` - plány akcí uživatelů
- `user_group_limits` - limity uživatelů na skupiny
- `user_behavioral_profiles` - behaviorální profily uživatelů

**Migrační postup:** Strukturu aktualizovat, data zachovat

### 🔄 AKTUALIZOVAT Z TEST VERZE
**Tabulky které se kompletně přepisují z ivy_test:**

- `variables` - systémové proměnné a verze
- `action_definitions` - definice akcí
- `c_districts` - číselník okresů
- `c_languages` - číselník jazyků  
- `c_portals` - číselník portálů
- `c_regions` - číselník krajů
- `quotes` - databáze citátů
- `rss_channels` - RSS kanály
- `rss_urls` - RSS URL adresy
- `referers` - statistiky odkudů

**Migrační postup:** `TRUNCATE` + `INSERT` z ivy_test

### ❌ IGNOROVAT
**Tabulky které se neřeší při migraci:**

- `heartbeat` - aktuální stav produkčních serverů (lokální data)
- `log_system` - systémové logy (každý server má vlastní)

### 🚫 VYLOUČIT Z PRODUKCE
**Tabulky které v produkci být nemají:**

- `translation_issues` - problémy s překlady (pouze dev)
- `debug_incidents` - debug záznamy (pouze dev)  
- `scheme` - databázové schéma (pouze dev)

### ⚠️ PROBLEMATICKÉ TABULKY
**Tabulky které existují ale neměly by:**

- `action_quality` - měla být smazána, ale stále existuje
- `login_timeouts` - měla být smazána, ale používá se v AuthController.php

**AKCE POTŘEBNÉ:** Vyčistit tyto tabulky před migrací

## Migrační skripty

### 1. Příprava migrace

```sql
-- Záloha produkční databáze
mysqldump -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD ivy > backups/ivy_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Strukturní změny

```sql
-- Vytvoření chybějících tabulek v produkci
CREATE TABLE ivy.group_keywords LIKE ivy_test.group_keywords;
CREATE TABLE ivy.group_word_associations LIKE ivy_test.group_word_associations;

-- Odstranění tabulek které nemají být v produkci
DROP TABLE IF EXISTS ivy.translation_issues;
DROP TABLE IF EXISTS ivy.debug_incidents;
DROP TABLE IF EXISTS ivy.scheme;
```

### 3. Datová migrace

```sql
-- Aktualizace číselníků a systémových dat
TRUNCATE ivy.variables; INSERT INTO ivy.variables SELECT * FROM ivy_test.variables;
TRUNCATE ivy.c_districts; INSERT INTO ivy.c_districts SELECT * FROM ivy_test.c_districts;
TRUNCATE ivy.c_languages; INSERT INTO ivy.c_languages SELECT * FROM ivy_test.c_languages;
TRUNCATE ivy.c_portals; INSERT INTO ivy.c_portals SELECT * FROM ivy_test.c_portals;
TRUNCATE ivy.c_regions; INSERT INTO ivy.c_regions SELECT * FROM ivy_test.c_regions;
TRUNCATE ivy.quotes; INSERT INTO ivy.quotes SELECT * FROM ivy_test.quotes;
TRUNCATE ivy.rss_channels; INSERT INTO ivy.rss_channels SELECT * FROM ivy_test.rss_channels;
TRUNCATE ivy.rss_urls; INSERT INTO ivy.rss_urls SELECT * FROM ivy_test.rss_urls;
TRUNCATE ivy.referers; INSERT INTO ivy.referers SELECT * FROM ivy_test.referers;
```

### 4. Ověření migrace

```sql
-- Kontrola počtu záznamů
SELECT 'fb_users' as tabulka, COUNT(*) as produkce FROM ivy.fb_users
UNION SELECT 'fb_groups', COUNT(*) FROM ivy.fb_groups  
UNION SELECT 'action_log', COUNT(*) FROM ivy.action_log
UNION SELECT 'variables', COUNT(*) FROM ivy.variables;
```

## Automatizace

### Bash script pro kompletní migraci

```bash
#!/bin/bash
# migrate_test_to_production.sh

# 1. Záloha
mysqldump -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD ivy > "backups/ivy_backup_$(date +%Y%m%d_%H%M%S).sql"

# 2. Strukturní migrace
mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD < migration_structure.sql

# 3. Datová migrace  
mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD < migration_data.sql

# 4. Ověření
mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD < migration_verify.sql
```

## Bezpečnostní opatření

1. **Vždy záloha** před migrací
2. **Testovací běh** na kopii databáze
3. **Rollback plán** připraven
4. **Ověření dat** po migraci
5. **Monitoring** po nasazení

## Poznámky

- Migrace probíhá při přechodu main → production
- Kritická data produkce se NIKDY nepřepisují
- Vždy ověřit funkčnost aplikace po migraci
- Rollback možný do 24 hodin po migraci

---
*Dokument vytvořen: 2025-08-07*  
*Verze: 1.0*