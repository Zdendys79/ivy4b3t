#!/bin/bash

# start-main.sh - Wrapper pro spuštění IVY s main větví
# Jednoduše volá start.sh s parametrem "main"

echo "🔄 Spouštím IVY s main větví..."
exec "$(dirname "$0")/start.sh" main "$@"