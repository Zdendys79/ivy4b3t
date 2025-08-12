#!/bin/bash
# Script pro nastavení databázových proměnných v Apache
# Používá pouze existující systémové proměnné

echo "Kontrola systémových proměnných..."

# Ověření, že proměnné existují
if [ -z "$MYSQL_HOST" ] || [ -z "$MYSQL_DATABASE" ] || [ -z "$MYSQL_USER" ] || [ -z "$MYSQL_PASSWORD" ]; then
    echo "CHYBA: Některé databázové proměnné nejsou nastaveny!"
    echo "Očekávané proměnné: MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD"
    echo "Aktuální stav:"
    echo "  MYSQL_HOST=$MYSQL_HOST"
    echo "  MYSQL_DATABASE=$MYSQL_DATABASE"
    echo "  MYSQL_USER=$MYSQL_USER"
    echo "  MYSQL_PASSWORD=[skryto]"
    exit 1
fi

echo "Všechny proměnné nalezeny. Přidávám do Apache konfigurace..."

# Kontrola, zda už nejsou v envvars
if sudo grep -q "MYSQL_HOST" /etc/apache2/envvars; then
    echo "Databázové proměnné už jsou v /etc/apache2/envvars nastaveny."
    echo "Pro aktualizaci je nejprve odstraňte ručně."
else
    # Přidání do /etc/apache2/envvars (vyžaduje sudo)
    echo "" | sudo tee -a /etc/apache2/envvars
    echo "# Database environment variables (added by setup_db_env.sh)" | sudo tee -a /etc/apache2/envvars
    echo "export MYSQL_HOST=\"$MYSQL_HOST\"" | sudo tee -a /etc/apache2/envvars
    echo "export MYSQL_PORT=\"$MYSQL_PORT\"" | sudo tee -a /etc/apache2/envvars
    echo "export MYSQL_DATABASE=\"$MYSQL_DATABASE\"" | sudo tee -a /etc/apache2/envvars
    echo "export MYSQL_USER=\"$MYSQL_USER\"" | sudo tee -a /etc/apache2/envvars
    echo "export MYSQL_PASSWORD=\"$MYSQL_PASSWORD\"" | sudo tee -a /etc/apache2/envvars
    echo "Proměnné přidány do /etc/apache2/envvars"
fi

echo ""
echo "Nastavení dokončeno. Pro aplikaci změn restartujte Apache:"
echo "  sudo systemctl restart apache2"