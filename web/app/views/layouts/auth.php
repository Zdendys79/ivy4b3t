<?php
/**
 * File: auth.php
 * Location: ~/web/app/views/layouts/auth.php
 *
 * Purpose: Authentication layout for login and registration pages.
 *          Minimal design focused on authentication forms.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}
?>
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="IVY4B3T - FB Automation System Login">
    <meta name="author" content="IVY4B3T Framework">

    <title><?php echo htmlspecialchars($page_title ?? 'IVY4B3T - Login'); ?></title>

    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="<?php echo $this->asset('images/favicon.ico'); ?>">

    <!-- Preload critical assets -->
    <link rel="preload" href="<?php echo $this->asset('css/app.css'); ?>" as="style">
    <link rel="preload" href="<?php echo $this->asset('css/pages/login.css'); ?>" as="style">

    <!-- CSS -->
    <link href="<?php echo $this->asset('css/app.css'); ?>" rel="stylesheet">
    <link href="<?php echo $this->asset('css/pages/login.css'); ?>" rel="stylesheet">

    <!-- Meta tags for security -->
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta http-equiv="X-Frame-Options" content="DENY">
    <meta http-equiv="X-XSS-Protection" content="1; mode=block">

    <!-- CSRF Token -->
    <meta name="csrf-token" content="<?php echo htmlspecialchars($csrf_token ?? ''); ?>">

    <!-- Prevent password managers from auto-filling (security) -->
    <meta name="format-detection" content="telephone=no">
</head>

<body class="auth-layout login-page">
    <!-- Main Content -->
    <main class="auth-main">
        <!-- Flash Messages -->
        <?php if (isset($flash) && $flash): ?>
            <div class="auth-flash">
                <div class="alert alert-<?php echo htmlspecialchars($flash['type']); ?> fade-in">
                    <div class="alert-content">
                        <span class="alert-icon">
                            <?php
                            $icons = [
                                'success' => '✅',
                                'error' => '❌',
                                'warning' => '⚠️',
                                'info' => 'ℹ️'
                            ];
                            echo $icons[$flash['type']] ?? 'ℹ️';
                            ?>
                        </span>
                        <span class="alert-message">
                            <?php echo htmlspecialchars($flash['message']); ?>
                        </span>
                        <button class="alert-close" onclick="this.parentElement.parentElement.style.display='none'">
                            &times;
                        </button>
                    </div>
                </div>
            </div>
        <?php endif; ?>

        <!-- Page Content -->
        <?php echo $content ?? ''; ?>
    </main>

    <!-- Footer -->
    <footer class="auth-footer">
        <div class="footer-content">
            <div class="footer-info">
                <p class="footer-text">
                    Powered by <strong>IVY4B3T Framework</strong> v2.0<br>
                    <small>© <?php echo date('Y'); ?> All rights reserved</small>
                </p>
            </div>

            <div class="footer-links">
                <a href="/about" class="footer-link">About</a>
                <a href="/privacy" class="footer-link">Privacy</a>
                <a href="/support" class="footer-link">Support</a>

                <?php if ($debug_mode ?? false): ?>
                    <span class="debug-badge">DEBUG</span>
                <?php endif; ?>
            </div>
        </div>
    </footer>

    <!-- Loading Overlay -->
    <div class="loading-overlay" id="auth-loading" style="display: none;">
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-message">Authenticating...</div>
        </div>
    </div>

    <!-- Core JavaScript -->
    <script src="<?php echo $this->asset('js/app.js'); ?>"></script>
    <script src="<?php echo $this->asset('js/pages/login.js'); ?>"></script>

    <!-- Authentication JavaScript -->
    <script>
        // Global configuration for auth pages
        window.IVY_AUTH_CONFIG = {
            debug: <?php echo json_encode($debug_mode ?? false); ?>,
            csrfToken: '<?php echo htmlspecialchars($csrf_token ?? ''); ?>',
            redirectUrl: '<?php echo htmlspecialchars($_GET['redirect'] ?? '/dashboard'); ?>',
            maxAttempts: 5,
            lockoutTime: 900000 // 15 minutes in milliseconds
        };

        // Initialize authentication functionality
        document.addEventListener('ivy:ready', function() {
            // Setup CSRF token for AJAX requests
            if (window.IVY && window.IVY.utils && window.IVY.utils.ajax) {
                IVY.utils.ajax.defaults = IVY.utils.ajax.defaults || {};
                IVY.utils.ajax.defaults.headers = IVY.utils.ajax.defaults.headers || {};
                IVY.utils.ajax.defaults.headers['X-CSRF-Token'] = window.IVY_AUTH_CONFIG.csrfToken;
            }

            // Auto-hide flash messages after 5 seconds
            const flashMessages = document.querySelectorAll('.auth-flash .alert');
            flashMessages.forEach(alert => {
                setTimeout(() => {
                    alert.style.opacity = '0';
                    setTimeout(() => {
                        if (alert.parentElement) {
                            alert.parentElement.style.display = 'none';
                        }
                    }, 300);
                }, 5000);
            });

            // Focus on first input field
            const firstInput = document.querySelector('input[type="text"], input[type="email"]');
            if (firstInput) {
                firstInput.focus();
            }

            // Enhanced form validation
            const authForm = document.querySelector('.auth-form, form[data-auth]');
            if (authForm) {
                authForm.addEventListener('submit', function(e) {
                    const submitBtn = this.querySelector('button[type="submit"]');
                    const username = this.querySelector('input[name="username"]');
                    const password = this.querySelector('input[name="password"]');

                    // Basic validation
                    if (!username.value.trim() || !password.value.trim()) {
                        e.preventDefault();

                        if (window.IVY && window.IVY.components && window.IVY.components.Toast) {
                            IVY.components.Toast.error('Please fill in all required fields');
                        } else {
                            alert('Please fill in all required fields');
                        }
                        return;
                    }

                    // Show loading state
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.innerHTML = '🔄 Authenticating...';
                        submitBtn.classList.add('loading');
                    }

                    // Show loading overlay
                    const loadingOverlay = document.getElementById('auth-loading');
                    if (loadingOverlay) {
                        loadingOverlay.style.display = 'flex';
                    }

                    // Store attempt in sessionStorage for rate limiting
                    try {
                        const attempts = JSON.parse(sessionStorage.getItem('login_attempts') || '[]');
                        attempts.push(Date.now());

                        // Keep only attempts from last 15 minutes
                        const cutoff = Date.now() - window.IVY_AUTH_CONFIG.lockoutTime;
                        const recentAttempts = attempts.filter(time => time > cutoff);

                        sessionStorage.setItem('login_attempts', JSON.stringify(recentAttempts));

                        // Check rate limit
                        if (recentAttempts.length >= window.IVY_AUTH_CONFIG.maxAttempts) {
                            e.preventDefault();

                            if (submitBtn) {
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = '🔐 Přihlásit se';
                                submitBtn.classList.remove('loading');
                            }

                            if (loadingOverlay) {
                                loadingOverlay.style.display = 'none';
                            }

                            if (window.IVY && window.IVY.components && window.IVY.components.Toast) {
                                IVY.components.Toast.error('Too many login attempts. Please wait 15 minutes.');
                            } else {
                                alert('Too many login attempts. Please wait 15 minutes.');
                            }
                            return;
                        }
                    } catch (e) {
                        // sessionStorage not available, continue anyway
                    }
                });

                // Reset form state if submission fails
                setTimeout(() => {
                    const submitBtn = authForm.querySelector('button[type="submit"]');
                    const loadingOverlay = document.getElementById('auth-loading');

                    if (submitBtn && submitBtn.classList.contains('loading')) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '🔐 Přihlásit se';
                        submitBtn.classList.remove('loading');
                    }

                    if (loadingOverlay && loadingOverlay.style.display === 'flex') {
                        loadingOverlay.style.display = 'none';
                    }
                }, 10000); // Reset after 10 seconds if no response
            }

            // Enhanced password field security
            const passwordField = document.querySelector('input[type="password"]');
            if (passwordField) {
                // Prevent password from being stored in browser history
                passwordField.setAttribute('autocomplete', 'current-password');
                passwordField.setAttribute('spellcheck', 'false');

                // Clear password on page unload (security)
                window.addEventListener('beforeunload', () => {
                    passwordField.value = '';
                });

                // Password strength indicator (optional)
                passwordField.addEventListener('input', function() {
                    const strength = calculatePasswordStrength(this.value);
                    updatePasswordStrengthIndicator(strength);
                });
            }

            // System status updates
            if (window.IVY_AUTH_CONFIG.debug) {
                console.log('🔐 Auth page loaded');
                console.log('CSRF Token:', window.IVY_AUTH_CONFIG.csrfToken.substring(0, 8) + '...');
                console.log('Redirect URL:', window.IVY_AUTH_CONFIG.redirectUrl);
            }

            // Check for successful authentication redirect
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('authenticated') === 'true') {
                if (window.IVY && window.IVY.components && window.IVY.components.Toast) {
                    IVY.components.Toast.success('Authentication successful! Redirecting...');
                }

                setTimeout(() => {
                    window.location.href = window.IVY_AUTH_CONFIG.redirectUrl;
                }, 1500);
            }
        });

        // Password strength calculation
        function calculatePasswordStrength(password) {
            let strength = 0;

            if (password.length >= 8) strength += 1;
            if (password.match(/[a-z]/)) strength += 1;
            if (password.match(/[A-Z]/)) strength += 1;
            if (password.match(/[0-9]/)) strength += 1;
            if (password.match(/[^a-zA-Z0-9]/)) strength += 1;

            return strength;
        }

        // Update password strength indicator
        function updatePasswordStrengthIndicator(strength) {
            const indicator = document.getElementById('password-strength');
            if (!indicator) return;

            const levels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
            const colors = ['#dc3545', '#fd7e14', '#ffc107', '#20c997', '#28a745'];

            indicator.textContent = levels[strength] || 'Very Weak';
            indicator.style.color = colors[strength] || colors[0];
        }

        // Global error handler for auth pages
        window.addEventListener('error', function(e) {
            if (window.IVY_AUTH_CONFIG.debug) {
                console.error('Auth page error:', e.error);
            }

            // Hide loading overlay on error
            const loadingOverlay = document.getElementById('auth-loading');
            if (loadingOverlay && loadingOverlay.style.display === 'flex') {
                loadingOverlay.style.display = 'none';
            }

            // Reset form state
            const submitBtn = document.querySelector('button[type="submit"].loading');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '🔐 Přihlásit se';
                submitBtn.classList.remove('loading');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Ctrl+L or Cmd+L to focus login field
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                const usernameField = document.querySelector('input[name="username"]');
                if (usernameField) {
                    usernameField.focus();
                    usernameField.select();
                }
            }

            // ESC to clear form
            if (e.key === 'Escape') {
                const form = document.querySelector('.auth-form, form[data-auth]');
                if (form && confirm('Clear form?')) {
                    form.reset();
                    const firstInput = form.querySelector('input[type="text"], input[type="email"]');
                    if (firstInput) {
                        firstInput.focus();
                    }
                }
            }
        });

        // Auto-refresh system status (if displayed)
        if (document.querySelector('.system-status')) {
            setInterval(function() {
                // Refresh system status every 30 seconds
                fetch('/api/system/status')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            updateSystemStatus(data.status);
                        }
                    })
                    .catch(error => {
                        if (window.IVY_AUTH_CONFIG.debug) {
                            console.warn('Failed to update system status:', error);
                        }
                    });
            }, 30000);
        }

        function updateSystemStatus(status) {
            const activeHosts = document.querySelector('.status-value[data-metric="active_hosts"]');
            const totalUsers = document.querySelector('.status-value[data-metric="total_users"]');

            if (activeHosts && status.active_hosts !== undefined) {
                activeHosts.textContent = status.active_hosts;
            }

            if (totalUsers && status.total_users !== undefined) {
                totalUsers.textContent = status.total_users;
            }
        }
    </script>

    <?php if (isset($inline_js)): ?>
        <script><?php echo $inline_js; ?></script>
    <?php endif; ?>

    <!-- Schema.org structured data for SEO -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "IVY4B3T",
        "description": "FB Automation System",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "permissions": "authentication required"
    }
    </script>
</body>
</html>
