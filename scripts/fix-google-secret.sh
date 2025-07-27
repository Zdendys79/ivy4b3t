#!/bin/bash

# Fix Google OAuth Client Secret
# Interactive script - asks for secret value only

if [ "$EUID" -ne 0 ]; then
    echo "❌ Spusť s sudo: sudo ./fix-google-secret.sh"
    exit 1
fi

echo "🔧 Google OAuth Client Secret Setup"
echo "=================================="
echo ""
echo "Secret bude uložen do /etc/apache2/envvars (mimo projekt)"
echo ""
read -s -p "Zadej Google Client Secret: " SECRET
echo ""

if [ -z "$SECRET" ]; then
    echo "❌ Secret je prázdný"
    exit 1
fi

echo ""
echo "🔧 Ukládám secret do Apache environment..."

# Update envvars file
if grep -q "export GOOGLE_CLIENT_SECRET=" /etc/apache2/envvars; then
    # Replace existing line
    sed -i "s/export GOOGLE_CLIENT_SECRET=.*/export GOOGLE_CLIENT_SECRET=\"$SECRET\"/" /etc/apache2/envvars
else
    # Add new line
    echo "" >> /etc/apache2/envvars
    echo "# Google OAuth Configuration" >> /etc/apache2/envvars
    echo "export GOOGLE_CLIENT_SECRET=\"$SECRET\"" >> /etc/apache2/envvars
fi

echo "✅ Google Client Secret opraven"

# Restart Apache
echo "🔄 Restartuji Apache..."
systemctl reload apache2

if [ $? -eq 0 ]; then
    echo "✅ Apache restartován!"
    echo "🧪 Zkus znovu OAuth test"
else
    echo "❌ Chyba při restartu Apache"
    exit 1
fi