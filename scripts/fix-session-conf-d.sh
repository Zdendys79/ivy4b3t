#!/bin/bash

echo "🔧 Fixing PHP Session Configuration in conf.d"
echo "============================================="

CONF_FILE="/etc/php/8.4/apache2/conf.d/99-ivy-sessions.ini"

echo "📋 Backing up existing conf.d session file..."
cp "$CONF_FILE" "$CONF_FILE.backup.$(date +%Y%m%d_%H%M%S)"

echo "🔧 Updating OAuth compatible session settings..."

# Create new OAuth compatible configuration
cat > "$CONF_FILE" << 'EOF'
; Session configuration for OAuth compatible persistent login
; Cookie lifetime: 0 = browser session, but GC keeps data longer
session.cookie_lifetime = 0
session.cookie_secure = 0
session.cookie_httponly = 1
session.cookie_samesite = "Lax"
session.use_strict_mode = 1

; Keep session data for 30 days
session.gc_maxlifetime = 2592000

; Clean up sessions less frequently (1% chance)
session.gc_probability = 1
session.gc_divisor = 100

; Use cookies only (no URL parameters)
session.use_cookies = 1
session.use_only_cookies = 1
session.use_trans_sid = 0

; Session storage
session.save_handler = files
session.save_path = "/tmp"
EOF

echo "📋 Verifying changes..."
echo "Cookie Secure: $(grep "session.cookie_secure" "$CONF_FILE")"
echo "Cookie SameSite: $(grep "session.cookie_samesite" "$CONF_FILE")"

echo ""
echo "🔄 Restarting Apache..."
systemctl restart apache2

if [ $? -eq 0 ]; then
    echo "✅ Apache restarted successfully"
else
    echo "❌ Apache restart failed"
    exit 1
fi

echo ""
echo "🧪 Testing new configuration via web..."
curl -s "https://ivy.zdendys79.website/test_session_config.php" | grep -E "(cookie_secure|cookie_samesite|SameSite)"

echo ""
echo "🎉 Session configuration fixed for OAuth compatibility!"
echo "💡 Teď zkus OAuth znovu - cookies by se měly ukládat!"