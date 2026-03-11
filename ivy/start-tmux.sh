#!/bin/bash
#
# start-tmux.sh
# Umístění: ~/ivy/start-tmux.sh
#
# Popis: Připojí se k existující ivy tmux session.
#        Pokud session neexistuje, informuje uživatele.
#        Spouštěj z SSH nebo terminálu v CRD.

SESSION="ivy"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "[TMUX] Připojuji se k session '$SESSION'..."
  exec tmux attach-session -t "$SESSION"
else
  echo "[TMUX] Session '$SESSION' neexistuje."
  echo "[TMUX] Ivy pravděpodobně neběží nebo ještě nespustil systemd service."
  echo "[TMUX] Zkus: systemctl --user status ivy"
  exit 1
fi
