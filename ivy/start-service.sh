#!/bin/bash
#
# start-service.sh
# Umístění: ~/ivy/start-service.sh
#
# Popis: Spustí ivy v pojmenované tmux session a blokuje (pro systemd Type=simple).
#        Pro ruční připojení k session: tmux attach-session -t ivy

SESSION="ivy"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Načíst uživatelské prostředí (DB_HOST, DB_USER atd.) — systemd .bashrc nenačítá
# shellcheck source=/dev/null
source ~/.bashrc 2>/dev/null || true

# Zabit existující session (čistý start)
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Spustit novou detached session
tmux new-session -d -s "$SESSION" -x 220 -y 50 \
  /bin/bash "$SCRIPT_DIR/start.sh" main

echo "[SERVICE] Ivy tmux session '$SESSION' spuštěna (PID tmux serveru: $(pgrep -x tmux | head -1))"

# Blokovat dokud session existuje — systemd sleduje tento proces
while tmux has-session -t "$SESSION" 2>/dev/null; do
  sleep 5
done

echo "[SERVICE] Ivy tmux session '$SESSION' ukončena."
