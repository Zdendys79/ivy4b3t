#!/bin/bash

echo "RYCHLÁ OPRAVA DISPLAY :20"
echo "========================="

# Restart Chrome Remote Desktop
echo "Restartuji Chrome Remote Desktop..."
systemctl --user restart chrome-remote-desktop

# Počkat 5 sekund
sleep 5

# Test DISPLAY
echo "Testuji DISPLAY :20..."
export DISPLAY=:20
if xdpyinfo >/dev/null 2>&1; then
    echo "✅ DISPLAY :20 funguje!"
else
    echo "❌ DISPLAY :20 stále nefunguje"
    echo "Zkouším restart X serveru..."
    sudo pkill -f "X.*:20"
    sleep 2
    sudo systemctl restart gdm3
fi

echo "Hotovo. Zkus se nyní připojit vzdálenou plochou."