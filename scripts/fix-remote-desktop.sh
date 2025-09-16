#!/bin/bash

echo "=== OPRAVA VZDÁLENÉ PLOCHY ==="
echo "Datum: $(date)"
echo "Host: $(hostname)"
echo ""

# Kontrola služeb
echo "1. Kontrola běžících služeb..."
ps aux | grep -E "(chrome|vnc|x11|remote)" | grep -v grep

echo ""
echo "2. Kontrola Chrome Remote Desktop..."
systemctl --user status chrome-remote-desktop 2>/dev/null || echo "Chrome Remote Desktop service nenalezen"

echo ""
echo "3. Restart X11 služeb..."
sudo pkill -f "X.*:20" 2>/dev/null || echo "X server na :20 neběží"
sudo systemctl restart gdm3 2>/dev/null || echo "GDM3 není dostupný"

echo ""
echo "4. Restart Chrome Remote Desktop..."
systemctl --user stop chrome-remote-desktop 2>/dev/null
sleep 2
systemctl --user start chrome-remote-desktop 2>/dev/null

echo ""
echo "5. Kontrola DISPLAY :20..."
export DISPLAY=:20
xdpyinfo 2>/dev/null && echo "DISPLAY :20 je aktivní" || echo "DISPLAY :20 není dostupný"

echo ""
echo "6. Test spuštění Chrome prohlížeče..."
timeout 10s google-chrome --version 2>/dev/null && echo "Chrome je dostupný" || echo "Chrome není dostupný"

echo ""
echo "7. Restart VNC serveru (pokud existuje)..."
sudo systemctl restart vncserver@:20 2>/dev/null || echo "VNC server není konfigurován"

echo ""
echo "8. Kontrola síťových portů pro vzdálené připojení..."
netstat -tln | grep -E ":590[0-9]|:5900|:22" || echo "Standardní VNC/SSH porty nejsou otevřené"

echo ""
echo "=== DOKONČENO ==="
echo "Pokud problém přetrvává, zkus:"
echo "1. Restartovat celý systém: sudo reboot"
echo "2. Zkontrolovat firewall: sudo ufw status"
echo "3. Zkontrolovat router/síťové nastavení"