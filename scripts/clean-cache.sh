#!/bin/bash
# Skript pro rychlé čištění cache prohlížečů
# BEZPEČNÝ - nemazá cookies ani přihlášení!

echo "🧹 === ČIŠTĚNÍ CACHE PROHLÍŽEČŮ ==="
echo

# Kontrola místa před čištěním
echo "📊 Stav disku PŘED čištěním:"
df -h / | grep -E "Filesystem|/dev/"
echo

# DeferredBrowserMetrics - největší problém (může mít 30+ GB!)
if [ -d "/home/remotes/Chromium/DeferredBrowserMetrics" ]; then
    SIZE=$(du -sh /home/remotes/Chromium/DeferredBrowserMetrics 2>/dev/null | cut -f1)
    echo "🗑️  Mažu DeferredBrowserMetrics: $SIZE"
    rm -rf /home/remotes/Chromium/DeferredBrowserMetrics
fi

# Cache složky (bezpečné k mazání)
echo "🧹 Čistím cache složky..."

# Chromium profily
for profile in /home/remotes/Chromium/Profile*; do
    if [ -d "$profile" ]; then
        echo -n "  Čistím $(basename $profile)... "
        rm -rf "$profile/Cache"/* 2>/dev/null
        rm -rf "$profile/Code Cache"/* 2>/dev/null
        rm -rf "$profile/GPUCache"/* 2>/dev/null
        rm -rf "$profile/Service Worker/CacheStorage"/* 2>/dev/null
        rm -rf "$profile/DeferredBrowserMetrics" 2>/dev/null
        echo "✓"
    fi
done

# Ivy browser profily
if [ -d "/home/remotes/ivy/browser-profiles" ]; then
    for profile in /home/remotes/ivy/browser-profiles/Profile*; do
        if [ -d "$profile" ]; then
            echo -n "  Čistím ivy/$(basename $profile)... "
            rm -rf "$profile/Cache"/* 2>/dev/null
            rm -rf "$profile/Code Cache"/* 2>/dev/null
            rm -rf "$profile/GPUCache"/* 2>/dev/null
            echo "✓"
        fi
    done
fi

# Puppeteer cache
if [ -d "/home/remotes/.cache/puppeteer" ]; then
    echo "  Čistím Puppeteer cache..."
    rm -rf /home/remotes/.cache/puppeteer/* 2>/dev/null
fi

# Tmp soubory Chromium
echo "🧹 Čistím dočasné soubory..."
rm -rf /tmp/.org.chromium.* 2>/dev/null
rm -rf /tmp/puppeteer_* 2>/dev/null

echo
echo "📊 Stav disku PO čištění:"
df -h / | grep -E "Filesystem|/dev/"

echo
echo "✅ Čištění dokončeno!"
echo "💡 TIP: Pokud je stále málo místa, zkontroluj:"
echo "   - Logy: /home/remotes/ivy/logs/"
echo "   - Debug reporty: /home/remotes/ivy/debug_reports/"