#!/bin/bash

# ------------------------------------------------------------------------
# Ivy4B3T – Instalace, aktualizace nebo odinstalace GIT klienta na Ubuntu
#
# Jak spustit:
#   chmod +x ~/Sync/manage-git.sh
#   ~/Sync/manage-git.sh install      # nainstaluje nebo aktualizuje GIT
#   ~/Sync/manage-git.sh remove       # odebere GIT ze systému
# ------------------------------------------------------------------------

ACTION=$1

if [ "$ACTION" = "remove" ]; then
    echo "🗑️ Odinstaluji Git..."
    sudo apt remove --purge -y git
    sudo apt autoremove -y
    echo "✅ Git byl odstraněn."
    exit 0
fi

echo "📦 Instalace nebo aktualizace GIT..."
sudo apt update
sudo apt install -y git

echo "✅ Git verze:"
git --version
