# Database Operations Guide - MariaDB

## KRITICKÉ PRAVIDLO
**MCP MySQL je READ-ONLY! Pro zápis VŽDY používar BASH!**

## Systémové Proměnné
- `$MYSQL_HOST`, `$MYSQL_PORT`, `$MYSQL_USER`, `$MYSQL_PASSWORD`, `$MYSQL_DATABASE`
- **VŽDY používat:** `$MYSQL_DATABASE` - systém automaticky vybere správnou databázi podle branch
- **NIKDY nespecifikovat:** "ivy_test" nebo "ivy" - používar pouze `$MYSQL_DATABASE`

## MariaDB operace přes MCP (READ-ONLY)

```javascript
// Zjistir dostupné databáze
mcp__mysql__list_databases()

// Zjistir tabulky v databázi
mcp__mysql__list_tables({ database: "ivy" })

// Popis struktury tabulky
mcp__mysql__describe_table({ table: "table_name", database: "ivy" })

// Spuštění SELECT dotazu
mcp__mysql__execute_query({ 
  database: "ivy", 
  query: "SELECT * FROM table_name LIMIT 10" 
})
```

### Databáze podle větve
- **Main větev:** ivy_test
- **Produkční větev:** ivy

## MariaDB operace přes BASH (READ/WRITE)

### 1. Jednoduchý INSERT/UPDATE/DELETE
```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "INSERT INTO ui_commands (host, command, data) VALUES ('Ubuntu-2D', 'call_user', '{\"user_id\": 25, \"name\": \"Dana Kopečná\"}')"
```

### 2. Batch operace (více příkazů)
```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "
INSERT INTO ui_commands (host, command, data) VALUES 
('Ubuntu-2D', 'call_user', '{\"user_id\": 25, \"name\": \"Dana Kopečná\"}'),
('Ubuntu-5D', 'call_user', '{\"user_id\": 11, \"name\": \"Nikola Synková\"}');"
```

### 3. Spuštění SQL souboru
```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < /path/to/script.sql
```

## KRITICKÉ POZNÁMKY

- **JSON escapování:** Používar `\"` místo `"` v JSON datech
- **Kontrola chyb:** Při selhání zkontrolovat JSON syntax a SQL
- **Databáze:** VŽDY používar `$MYSQL_DATABASE` - nikdy hardcode "ivy_test" nebo "ivy"
- **Ověření:** Po zápisu ověřir pomocí MCP SELECT dotazu
- **Podle pre-commit-hook.sh:** Toto je SPRÁVNÝ a OVĚŘENÝ postup