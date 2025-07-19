# Buy/Sell skupiny - optimalizace

## Popis

Pro prodejní skupiny na Facebooku je možné použít přímou navigaci na diskuzní část místo zdlouhavého klikání na tlačítko "Diskuze".

## Nový sloupec v databázi

Do tabulky `fb_groups` byl přidán sloupec:

```sql
is_buy_sell_group BOOLEAN NOT NULL DEFAULT FALSE 
COMMENT 'Označuje zda je skupina prodejní (buy/sell) pro přímý přístup k diskuzi'
```

## Použití

### Označení skupiny jako buy/sell

```sql
UPDATE fb_groups 
SET is_buy_sell_group = TRUE 
WHERE fb_id = 'ID_SKUPINY';
```

### Přímá navigace

Místo standardní URL: `https://www.facebook.com/groups/ID_SKUPINY/`

Pro buy/sell skupiny použít: `https://www.facebook.com/groups/ID_SKUPINY/buy_sell_discuss`

## Implementace v kódu

Při navigaci na skupinu zkontrolovat hodnotu `is_buy_sell_group`:

```javascript
if (groupData.is_buy_sell_group) {
  const discussUrl = `${groupUrl}/buy_sell_discuss`;
  await page.goto(discussUrl);
} else {
  await page.goto(groupUrl);
  // následuje klikání na "Diskuze"
}
```

## Výhody

- **Rychlejší navigace** - přímý přístup k diskuzní části
- **Menší zatížení** - méně HTTP requestů a DOM manipulací
- **Spolehlivější** - nezávislé na změnách v UI Facebooku
- **Úspora času** - eliminace čekání na načtení a klikání

## Migrace dat

Pro aplikaci změn na stávající databázi spustit:

```bash
# Použitím systémových proměnných (doporučeno)
mysql -u $DB_USER -p$DB_PASS ivy < add_buy_sell_group_column.sql

# Nebo direktně SQL příkazy
mysql -u $DB_USER -p$DB_PASS ivy -e "ALTER TABLE fb_groups ADD COLUMN IF NOT EXISTS is_buy_sell_group BOOLEAN NOT NULL DEFAULT FALSE;"
mysql -u $DB_USER -p$DB_PASS ivy -e "CREATE INDEX IF NOT EXISTS idx_is_buy_sell_group ON fb_groups(is_buy_sell_group);"
```

## Stav migrace

✅ **Sloupec byl úspěšně přidán do databáze** (2025-07-13)
- Sloupec: `is_buy_sell_group BOOLEAN NOT NULL DEFAULT FALSE`
- Index: `idx_is_buy_sell_group` pro optimalizaci dotazů
- Database: `ivy` na localhost pomocí `$DB_USER`