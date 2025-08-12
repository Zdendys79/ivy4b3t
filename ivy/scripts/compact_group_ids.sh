#!/bin/bash

# Script pro kompaktování ID v fb_groups tabulce
# Přesouvá nejvyšší ID na nejnižší díry v číslování

echo "=== Kompaktování fb_groups ID ==="
echo "Před kompaktováním:"

mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "ivy" -e "
SELECT 
  MIN(id) as min_id, 
  MAX(id) as max_id, 
  COUNT(*) as total_records,
  MAX(id) - MIN(id) + 1 - COUNT(*) as gaps_count
FROM fb_groups;
"

# Hlavní loop - dokud máme díry
while true; do
    echo "--- Hledám díry a vysoká ID ---"
    
    # Najdi nejnižší díru
    GAP=$(mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "ivy" -N -e "
    SELECT (t1.id + 1) as gap_start
    FROM fb_groups t1
    LEFT JOIN fb_groups t2 ON t1.id + 1 = t2.id
    WHERE t2.id IS NULL AND t1.id < (SELECT MAX(id) FROM fb_groups)
    ORDER BY gap_start
    LIMIT 1;
    ")
    
    # Najdi nejvyšší ID
    HIGH_ID=$(mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "ivy" -N -e "
    SELECT MAX(id) FROM fb_groups;
    ")
    
    # Pokud nemáme díru nebo už není co přesouvat
    if [[ -z "$GAP" ]] || [[ "$HIGH_ID" -le "$GAP" ]]; then
        echo "Žádné další díry k zaplnění nebo už je vše kompaktní!"
        break
    fi
    
    echo "Přesouvám ID $HIGH_ID → $GAP"
    
    # Proveď přesun
    mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "ivy" -e "
    UPDATE fb_groups SET id = $GAP WHERE id = $HIGH_ID;
    "
    
    # Krátká pauza pro sledování postupu
    sleep 0.1
done

echo "=== HOTOVO ==="
echo "Po kompaktování:"

mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "ivy" -e "
SELECT 
  MIN(id) as min_id, 
  MAX(id) as max_id, 
  COUNT(*) as total_records,
  MAX(id) - MIN(id) + 1 - COUNT(*) as gaps_count
FROM fb_groups;
"

echo "Resetuji AUTO_INCREMENT počítadlo..."

# Reset AUTO_INCREMENT na MAX(id) + 1
NEXT_ID=$(mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "ivy" -N -e "
SELECT MAX(id) + 1 FROM fb_groups;
")

mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "ivy" -e "
ALTER TABLE fb_groups AUTO_INCREMENT = $NEXT_ID;
"

echo "AUTO_INCREMENT nastaveno na: $NEXT_ID"