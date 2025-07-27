<?php
/**
 * File: app.php
 * Location: ~/web/app/views/layouts/app.php
 *
 * Purpose: Main application layout for authenticated pages.
 *          Includes navigation, sidebar, and common structure for dashboard pages.
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
    <meta name="description" content="IVY4B3T - FB Automation System Dashboard">
    <meta name="author" content="IVY4B3T Framework">

    <title><?php echo htmlspecialchars($page_title ?? 'IVY4B3T Dashboard'); ?></title>

    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="<?php echo $this->asset('images/favicon.ico'); ?>">

    <!-- CSS -->
    <link href="<?php echo $this->asset('css/app.css'); ?>" rel="stylesheet">
    <link href="<?php echo $this->asset('css/components.css'); ?>" rel="stylesheet">

    <?php if (isset($page_css)): ?>
        <?php foreach ($page_css as $css): ?>
            <link href="<?php echo $this->asset("css/pages/{$css}.css"); ?>" rel="stylesheet">
        <?php endforeach; ?>
    <?php endif; ?>

    <!-- Meta tags for security -->
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta http-equiv="X-Frame-Options" content="DENY">
    <meta http-equiv="X-XSS-Protection" content="1; mode=block">

    <!-- CSRF Token -->
    <meta name="csrf-token" content="<?php echo htmlspecialchars($csrf_token ?? ''); ?>">
</head>

<body class="app-layout">
    <!-- Navigation Bar -->
    <nav class="navbar navbar-main">
        <div class="navbar-container">
            <!-- Brand -->
            <div class="navbar-brand">
                <a href="/dashboard" class="brand-link">
                    <span class="brand-icon">🤖</span>
                    <span class="brand-text">IVY4B3T</span>
                </a>
            </div>

            <!-- Navigation Menu -->
            <div class="navbar-menu">
                <div class="navbar-nav">
                    <a href="/dashboard" class="nav-link <?php echo $this->is('/dashboard') ? 'active' : ''; ?>">
                        📊 Dashboard
                    </a>
                    <a href="/users" class="nav-link <?php echo $this->is('/users') ? 'active' : ''; ?>">
                        👥 Users
                    </a>
                    <a href="/group-limits" class="nav-link <?php echo $this->is('/group-limits') ? 'active' : ''; ?>">
                        ⚙️ Group Limits
                    </a>
                    <a href="/scheme" class="nav-link <?php echo $this->is('/scheme') ? 'active' : ''; ?>">
                        🌳 System Scheme
                    </a>
                </div>
            </div>

            <!-- User Menu -->
            <div class="navbar-user">
                <div class="user-dropdown">
                    <button class="user-button" data-dropdown="user-menu">
                        <span class="user-avatar">
                            <?php echo strtoupper(substr($current_user['name'] ?? 'U', 0, 1)); ?>
                        </span>
                        <span class="user-name">
                            <?php echo htmlspecialchars($current_user['name'] ?? 'User'); ?>
                        </span>
                        <span class="dropdown-arrow">▼</span>
                    </button>

                    <div class="dropdown-menu" id="user-menu">
                        <div class="dropdown-header">
                            <div class="user-info">
                                <div class="user-full-name">
                                    <?php echo htmlspecialchars(($current_user['name'] ?? '') . ' ' . ($current_user['surname'] ?? '')); ?>
                                </div>
                                <div class="user-id">ID: <?php echo htmlspecialchars($current_user['id'] ?? ''); ?></div>
                            </div>
                        </div>

                        <div class="dropdown-divider"></div>

                        <a href="/profile" class="dropdown-item">
                            👤 Profile Settings
                        </a>
                        <a href="/preferences" class="dropdown-item">
                            ⚙️ Preferences
                        </a>

                        <?php if (($current_user['id'] ?? 999) < 10): // Admin users ?>
                        <div class="dropdown-divider"></div>
                        <a href="/admin" class="dropdown-item">
                            🔧 Admin Panel
                        </a>
                        <?php endif; ?>

                        <div class="dropdown-divider"></div>

                        <a href="/logout" class="dropdown-item logout-link">
                            🚪 Logout
                        </a>
                    </div>
                </div>
            </div>

            <!-- Mobile Menu Toggle -->
            <button class="mobile-menu-toggle" data-toggle="mobile-menu">
                <span class="hamburger-line"></span>
                <span class="hamburger-line"></span>
                <span class="hamburger-line"></span>
            </button>
        </div>
    </nav>

    <!-- Main Content Area -->
    <main class="main-content">
        <!-- Flash Messages -->
        <?php if (isset($flash) && $flash): ?>
            <div class="flash-container">
                <div class="alert alert-<?php echo htmlspecialchars($flash['type']); ?> flash-message">
                    <button class="alert-close" onclick="this.parentElement.style.display='none'">&times;</button>
                    <?php echo htmlspecialchars($flash['message']); ?>
                </div>
            </div>
        <?php endif; ?>

        <!-- Page Content -->
        <div class="content-container">
            <?php echo $content ?? ''; ?>
        </div>
    </main>

    <!-- Status Bar -->
    <div class="status-bar">
        <div class="status-container">
            <div class="status-item">
                <span class="status-label">Status:</span>
                <span class="status-value" id="system-status">
                    <span class="status-dot status-online"></span>
                    Online
                </span>
            </div>

            <div class="status-item">
                <span class="status-label">Last Update:</span>
                <span class="status-value" id="last-update">
                    <?php echo date('H:i:s'); ?>
                </span>
            </div>

            <div class="status-item">
                <span class="status-label">Version:</span>
                <span class="status-value">
                    <?php echo htmlspecialchars($assets_version ?? 'v2.0'); ?>
                </span>
            </div>

            <?php if ($debug_mode ?? false): ?>
            <div class="status-item debug-indicator">
                <span class="status-label">Debug:</span>
                <span class="status-value">ON</span>
            </div>
            <?php endif; ?>
        </div>
    </div>

    <!-- Loading Overlay -->
    <div class="loading-overlay" id="loading-overlay" style="display: none;">
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-message">Loading...</div>
        </div>
    </div>

    <!-- Toast Container -->
    <div class="toast-container" id="toast-container"></div>

    <!-- Core JavaScript -->
    <script src="<?php echo $this->asset('js/app.js'); ?>"></script>

    <?php if (isset($page_js)): ?>
        <?php foreach ($page_js as $js): ?>
            <script src="<?php echo $this->asset("js/pages/{$js}.js"); ?>"></script>
        <?php endforeach; ?>
    <?php endif; ?>

    <!-- Page-specific JavaScript -->
    <script>
        // Global configuration
        window.IVY_CONFIG = {
            debug: <?php echo json_encode($debug_mode ?? false); ?>,
            csrfToken: '<?php echo htmlspecialchars($csrf_token ?? ''); ?>',
            userId: <?php echo json_encode($current_user['id'] ?? null); ?>,
            refreshInterval: <?php echo json_encode($refresh_interval ?? 30000); ?>
        };

        // Initialize page-specific functionality
        document.addEventListener('ivy:ready', function() {
            // Setup CSRF token for AJAX requests
            IVY.utils.ajax.defaults.headers['X-CSRF-Token'] = window.IVY_CONFIG.csrfToken;

            // Setup auto-refresh if enabled
            if (window.IVY_CONFIG.refreshInterval > 0) {
                setInterval(function() {
                    if (typeof window.refreshPageData === 'function') {
                        window.refreshPageData();
                    }
                }, window.IVY_CONFIG.refreshInterval);
            }

            // Setup logout confirmation
            const logoutLinks = document.querySelectorAll('.logout-link');
            logoutLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    if (!confirm('Are you sure you want to logout?')) {
                        e.preventDefault();
                    }
                });
            });

            // Setup dropdown menus
            document.querySelectorAll('[data-dropdown]').forEach(trigger => {
                const targetId = trigger.getAttribute('data-dropdown');
                const menu = document.getElementById(targetId);

                if (menu) {
                    trigger.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();

                        // Close other dropdowns
                        document.querySelectorAll('.dropdown-menu.show').forEach(otherMenu => {
                            if (otherMenu !== menu) {
                                otherMenu.classList.remove('show');
                            }
                        });

                        // Toggle current dropdown
                        menu.classList.toggle('show');
                    });
                }
            });

            // Close dropdowns when clicking outside
            document.addEventListener('click', function() {
                document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                    menu.classList.remove('show');
                });
            });

            // Setup mobile menu
            const mobileToggle = document.querySelector('[data-toggle="mobile-menu"]');
            if (mobileToggle) {
                mobileToggle.addEventListener('click', function() {
                    document.body.classList.toggle('mobile-menu-open');
                });
            }

            <?php if ($debug_mode ?? false): ?>
            // Debug mode logging
            console.log('🤖 IVY4B3T Dashboard loaded');
            console.log('Current user:', <?php echo json_encode($current_user ?? null); ?>);
            console.log('Page data:', {
                title: '<?php echo addslashes($page_title ?? ''); ?>',
                debug: true,
                timestamp: '<?php echo date('Y-m-d H:i:s'); ?>'
            });
            <?php endif; ?>
        });

        // Global error handler
        window.addEventListener('error', function(e) {
            if (window.IVY_CONFIG.debug) {
                console.error('JavaScript error:', e.error);
            }

            // Show user-friendly error message
            if (window.IVY && window.IVY.components && window.IVY.components.Toast) {
                IVY.components.Toast.error('An unexpected error occurred. Please refresh the page.');
            }
        });
    </script>

    <?php if (isset($inline_js)): ?>
        <script><?php echo $inline_js; ?></script>
    <?php endif; ?>
</body>
</html>
