<?php
/**
 * File: login.php
 * Location: ~/web/app/views/auth/login.php
 *
 * Purpose: Login form view with enhanced security and user experience.
 *          Modern design with real-time system status display.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}
?>

<div class="login-container">
    <!-- Logo Section -->
    <div class="login-logo">
        <span class="emoji">🤖</span>
        <h1>IVY4B3T</h1>
        <p>Facebook Automation System</p>
    </div>

    <!-- Login Form -->
    <form method="POST" action="/authenticate" class="login-form" data-auth>
        <!-- CSRF Token -->
        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token ?? ''); ?>">

        <!-- Redirect URL -->
        <?php if (isset($_GET['redirect'])): ?>
            <input type="hidden" name="redirect" value="<?php echo htmlspecialchars($_GET['redirect']); ?>">
        <?php endif; ?>

        <!-- Username Field -->
        <div class="form-group">
            <label for="username" class="form-label">Uživatelské jméno</label>
            <div class="input-group">
                <input
                    type="text"
                    name="username"
                    id="username"
                    class="form-control"
                    placeholder="Zadejte FB login"
                    value="<?php echo htmlspecialchars($_POST['username'] ?? ''); ?>"
                    required
                    autocomplete="username"
                    spellcheck="false"
                >
                <span class="input-icon">👤</span>
            </div>
        </div>

        <!-- Password Field -->
        <div class="form-group">
            <label for="password" class="form-label">Heslo</label>
            <div class="input-group">
                <input
                    type="password"
                    name="password"
                    id="password"
                    class="form-control"
                    placeholder="Zadejte heslo"
                    required
                    autocomplete="current-password"
                    spellcheck="false"
                >
                <span class="input-icon">🔒</span>
            </div>

            <!-- Password Strength Indicator (hidden by default) -->
            <div class="password-strength" id="password-strength" style="display: none;"></div>
        </div>

        <!-- Remember Me -->
        <div class="form-group">
            <label class="checkbox-label">
                <input type="checkbox" name="remember" value="1">
                <span class="checkbox-custom"></span>
                Zapamatovat přihlášení
            </label>
        </div>

        <!-- Submit Button -->
        <button type="submit" class="login-submit">
            🔐 Přihlásit se
        </button>

        <!-- Additional Options -->
        <div class="login-options">
            <a href="/forgot-password" class="forgot-link">Zapomenuté heslo?</a>
        </div>
    </form>

    <!-- System Status -->
    <?php if ($system_info): ?>
    <div class="system-status">
        <h6>📊 Stav systému</h6>
        <div class="status-grid">
            <div class="status-item">
                <div class="status-value" data-metric="active_hosts">
                    <?php echo htmlspecialchars($system_info['active_hosts']); ?>
                </div>
                <div class="status-label">Aktivní hosts</div>
            </div>
            <div class="status-item">
                <div class="status-value" data-metric="total_users">
                    <?php echo htmlspecialchars($system_info['total_users']); ?>
                </div>
                <div class="status-label">Celkem users</div>
            </div>
        </div>

        <!-- Additional System Info -->
        <div class="system-details">
            <div class="system-version">
                <?php echo htmlspecialchars($system_info['version']); ?>
            </div>

            <?php if ($system_info['active_users'] > 0): ?>
            <div class="system-activity">
                <span class="activity-dot"></span>
                <?php echo htmlspecialchars($system_info['active_users']); ?> aktivních uživatelů
            </div>
            <?php endif; ?>
        </div>
    </div>
    <?php endif; ?>

    <!-- Footer Information -->
    <div class="login-footer">
        <p>
            Powered by <strong>IVY4B3T Framework</strong><br>
            <small>Last update: <?php echo date('d.m.Y H:i'); ?></small>
        </p>

        <?php if ($debug_mode): ?>
        <div class="debug-info">
            <details>
                <summary>Debug Information</summary>
                <div class="debug-details">
                    <p><strong>Debug Mode:</strong> Active</p>
                    <p><strong>CSRF Token:</strong> <?php echo substr($csrf_token, 0, 8); ?>...</p>
                    <p><strong>Session ID:</strong> <?php echo substr(session_id(), 0, 8); ?>...</p>
                    <p><strong>Server Time:</strong> <?php echo date('Y-m-d H:i:s'); ?></p>
                    <p><strong>Client IP:</strong> <?php echo $_SERVER['REMOTE_ADDR'] ?? 'unknown'; ?></p>
                </div>
            </details>
        </div>
        <?php endif; ?>
    </div>
</div>

<!-- Login Page Specific JavaScript -->
<script>
document.addEventListener('ivy:ready', function() {
    // Login form enhancements
    const loginForm = document.querySelector('.login-form');
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    const submitButton = document.querySelector('.login-submit');

    // Enhanced username field behavior
    if (usernameField) {
        // Auto-format username (remove spaces, convert to lowercase)
        usernameField.addEventListener('blur', function() {
            this.value = this.value.trim().toLowerCase();
        });

        // Real-time validation feedback
        usernameField.addEventListener('input', function() {
            validateField(this);
        });
    }

    // Enhanced password field behavior
    if (passwordField) {
        // Show/hide password toggle
        const toggleButton = createPasswordToggle();
        passwordField.parentNode.appendChild(toggleButton);

        // Password strength indicator
        passwordField.addEventListener('input', function() {
            validateField(this);
            updatePasswordStrength(this.value);
        });

        // Caps lock detection
        passwordField.addEventListener('keyup', function(e) {
            detectCapsLock(e);
        });
    }

    // Form submission enhancements
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            // Final validation before submission
            if (!validateForm(this)) {
                e.preventDefault();
                return;
            }

            // Disable form to prevent double submission
            disableForm(this);

            // Analytics tracking (if enabled)
            trackLoginAttempt();
        });
    }

    // Auto-fill detection for better UX
    detectAutoFill();

    // Keyboard shortcuts
    setupKeyboardShortcuts();

    // Accessibility improvements
    setupAccessibility();
});

// Field validation
function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name;

    // Remove previous error state
    field.classList.remove('error', 'valid');

    // Basic validation
    if (fieldName === 'username') {
        if (value.length === 0) {
            setFieldError(field, 'Uživatelské jméno je povinné');
        } else if (value.length < 3) {
            setFieldError(field, 'Uživatelské jméno musí mít alespoň 3 znaky');
        } else {
            setFieldValid(field);
        }
    } else if (fieldName === 'password') {
        if (value.length === 0) {
            setFieldError(field, 'Heslo je povinné');
        } else if (value.length < 4) {
            setFieldError(field, 'Heslo musí mít alespoň 4 znaky');
        } else {
            setFieldValid(field);
        }
    }
}

function setFieldError(field, message) {
    field.classList.add('error');
    showFieldMessage(field, message, 'error');
}

function setFieldValid(field) {
    field.classList.add('valid');
    hideFieldMessage(field);
}

function showFieldMessage(field, message, type) {
    // Remove existing message
    hideFieldMessage(field);

    const messageEl = document.createElement('div');
    messageEl.className = `field-message field-message-${type}`;
    messageEl.textContent = message;

    field.parentNode.appendChild(messageEl);
}

function hideFieldMessage(field) {
    const existingMessage = field.parentNode.querySelector('.field-message');
    if (existingMessage) {
        existingMessage.remove();
    }
}

// Password toggle functionality
function createPasswordToggle() {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-toggle';
    toggle.innerHTML = '👁️';
    toggle.setAttribute('aria-label', 'Toggle password visibility');

    toggle.addEventListener('click', function() {
        const passwordField = document.getElementById('password');
        const isPassword = passwordField.type === 'password';

        passwordField.type = isPassword ? 'text' : 'password';
        this.innerHTML = isPassword ? '👁️‍🗨️' : '👁️';
        this.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });

    return toggle;
}

// Password strength indicator
function updatePasswordStrength(password) {
    const indicator = document.getElementById('password-strength');
    if (!indicator) return;

    const strength = calculatePasswordStrength(password);
    const levels = ['Velmi slabé', 'Slabé', 'Střední', 'Dobré', 'Silné'];
    const colors = ['#dc3545', '#fd7e14', '#ffc107', '#20c997', '#28a745'];

    if (password.length > 0) {
        indicator.style.display = 'block';
        indicator.textContent = `Síla hesla: ${levels[strength] || 'Velmi slabé'}`;
        indicator.style.color = colors[strength] || colors[0];
    } else {
        indicator.style.display = 'none';
    }
}

// Caps lock detection
function detectCapsLock(event) {
    const capsLockOn = event.getModifierState && event.getModifierState('CapsLock');
    const warning = document.getElementById('caps-lock-warning');

    if (capsLockOn) {
        if (!warning) {
            const warningEl = document.createElement('div');
            warningEl.id = 'caps-lock-warning';
            warningEl.className = 'caps-lock-warning';
            warningEl.innerHTML = '⚠️ Caps Lock je zapnutý';

            const passwordField = document.getElementById('password');
            passwordField.parentNode.appendChild(warningEl);
        }
    } else {
        if (warning) {
            warning.remove();
        }
    }
}

// Form validation
function validateForm(form) {
    const username = form.querySelector('[name="username"]').value.trim();
    const password = form.querySelector('[name="password"]').value;

    if (!username || !password) {
        if (window.IVY && window.IVY.components && window.IVY.components.Toast) {
            IVY.components.Toast.error('Všechna pole jsou povinná');
        }
        return false;
    }

    return true;
}

// Disable form during submission
function disableForm(form) {
    const inputs = form.querySelectorAll('input, button');
    inputs.forEach(input => {
        input.disabled = true;
    });

    const submitBtn = form.querySelector('.login-submit');
    if (submitBtn) {
        submitBtn.classList.add('loading');
    }
}

// Auto-fill detection
function detectAutoFill() {
    setTimeout(() => {
        const usernameField = document.getElementById('username');
        const passwordField = document.getElementById('password');

        if (usernameField && usernameField.value) {
            usernameField.classList.add('has-value');
        }

        if (passwordField && passwordField.value) {
            passwordField.classList.add('has-value');
        }
    }, 500);
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Enter key submission
        if (e.key === 'Enter' && !e.shiftKey) {
            const form = document.querySelector('.login-form');
            if (form && document.activeElement.tagName === 'INPUT') {
                e.preventDefault();
                form.dispatchEvent(new Event('submit'));
            }
        }
    });
}

// Accessibility improvements
function setupAccessibility() {
    // Add ARIA labels
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');

    if (usernameField) {
        usernameField.setAttribute('aria-describedby', 'username-help');
    }

    if (passwordField) {
        passwordField.setAttribute('aria-describedby', 'password-help');
    }

    // Focus management
    const form = document.querySelector('.login-form');
    if (form) {
        form.setAttribute('role', 'form');
        form.setAttribute('aria-label', 'Přihlašovací formulář');
    }
}

// Analytics tracking (placeholder)
function trackLoginAttempt() {
    if (window.IVY_CONFIG && window.IVY_CONFIG.debug) {
        console.log('Login attempt tracked at:', new Date().toISOString());
    }
}
</script>
