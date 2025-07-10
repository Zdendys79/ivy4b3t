#!/bin/bash

echo "=== IVY4B3T TEST SCRIPT ==="
echo "Testuje getUserWithAvailableActions metodu"
echo ""

cd "$(dirname "$0")"

# Kontrola závislostí
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js není nainstalován"
    exit 1
fi

echo "📂 Pracovní adresář: $(pwd)"
echo "🖥️  Hostname: $(hostname)"
echo ""

echo "🚀 Spouštím test..."
node test.js

echo ""
echo "✅ Test dokončen"