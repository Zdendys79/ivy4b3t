#!/bin/bash

# Spuštění opravy citátů v testovací databázi
echo "🔧 Opravuji sloupce text/original_text v tabulce quotes..."

mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -p$MYSQL_PASSWORD ${MYSQL_DATABASE}_test < /home/remotes/ivy4b3t/scripts/fix_quotes_columns.sql

echo "✅ Oprava dokončena!"

# Zobrazit výsledky
echo "📊 Výsledky opravy:"
mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -p$MYSQL_PASSWORD ${MYSQL_DATABASE}_test -e "
SELECT 
    language_code,
    COUNT(*) as count,
    COUNT(CASE WHEN original_text IS NOT NULL AND original_text != '' THEN 1 END) as with_original,
    COUNT(CASE WHEN text LIKE '[POTŘEBUJE PŘEKLAD]%' THEN 1 END) as needs_translation
FROM quotes 
GROUP BY language_code 
ORDER BY language_code;
"