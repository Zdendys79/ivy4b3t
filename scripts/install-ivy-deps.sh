#!/bin/bash

# ------------------------------------------------------------------------
# Ivy4B3T – Instalační skript pro Node.js závislosti v klientovi Ivy
# 
# Jak spustit na Linuxu (např. na virtuálu s Ubuntu):
#   chmod +x ~/Sync/install-ivy-deps.sh
#   ~/Sync/install-ivy-deps.sh
# 
# Předpoklad:
# - Node.js a npm jsou nainstalované (např. pomocí install-latest-node.sh)
# - Skript se spouští z uživatelova domovského adresáře
# ------------------------------------------------------------------------

echo "📁 Přecházím do složky ~/Sync/ivy"
cd ~/Sync/ivy || { echo "❌ Složka ~/Sync/ivy nenalezena"; exit 1; }

echo "📦 Instalace všech Node.js závislostí..."
npm install --omit=dev --no-audit --no-fund

echo "✅ Hotovo. Verze Puppeteer:"
npx puppeteer --version || echo "ℹ️ Puppeteer CLI není k dispozici – to je v pořádku"
