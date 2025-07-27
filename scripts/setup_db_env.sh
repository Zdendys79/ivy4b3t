#!/bin/bash
# Script pro nastavení databázových proměnných v Apache
# Používá pouze existující systémové proměnné

echo "Kontrola systémových proměnných..."

# Ověření, že proměnné existují
if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASS" ]; then
    echo "CHYBA: Některé databázové proměnné nejsou nastaveny!"
    echo "Očekávané proměnné: DB_HOST, DB_NAME, DB_USER, DB_PASS"
    echo "Aktuální stav:"
    echo "  DB_HOST=$DB_HOST"
    echo "  DB_NAME=$DB_NAME"
    echo "  DB_USER=$DB_USER"
    echo "  DB_PASS=[skryto]"
    exit 1
fi

echo "Všechny proměnné nalezeny. Přidávám do Apache konfigurace..."

# Kontrola, zda už nejsou v envvars
if sudo grep -q "DB_HOST" /etc/apache2/envvars; then
    echo "Databázové proměnné už jsou v /etc/apache2/envvars nastaveny."
    echo "Pro aktualizaci je nejprve odstraňte ručně."
else
    # Přidání do /etc/apache2/envvars (vyžaduje sudo)
    echo "" | sudo tee -a /etc/apache2/envvars
    echo "# Database environment variables (added by setup_db_env.sh)" | sudo tee -a /etc/apache2/envvars
    echo "export DB_HOST=\"$DB_HOST\"" | sudo tee -a /etc/apache2/envvars
    echo "export DB_NAME=\"$DB_NAME\"" | sudo tee -a /etc/apache2/envvars
    echo "export DB_USER=\"$DB_USER\"" | sudo tee -a /etc/apache2/envvars
    echo "export DB_PASS=\"$DB_PASS\"" | sudo tee -a /etc/apache2/envvars
    echo "Proměnné přidány do /etc/apache2/envvars"
fi

echo ""
echo "Nastavení dokončeno. Pro aplikaci změn restartujte Apache:"
echo "  sudo systemctl restart apache2"