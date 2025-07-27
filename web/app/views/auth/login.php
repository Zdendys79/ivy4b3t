<?php
/**
 * File: login.php
 * Location: ~/web/app/views/auth/login.php
 *
 * Purpose: Admin login via Google OAuth only.
 *          Simplified authentication for administrators.
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
        <p>FB Automation System - Admin Panel</p>
    </div>

    <!-- Admin Notice -->
    <div style="
        background: #e3f2fd;
        border: 1px solid #2196f3;
        border-radius: 8px;
        padding: 15px;
        margin: 20px 0;
        text-align: center;
        color: #1976d2;
        font-size: 14px;
    ">
        🔐 Přístup pouze pro správce systému<br>
        Přihlášení je možné pouze přes Google OAuth
    </div>
    
    <!-- Google OAuth Login -->
    <a href="/auth/google" style="
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 15px;
        width: 100%;
        padding: 15px 20px;
        border: 2px solid #dadce0;
        border-radius: 10px;
        background: white;
        color: #3c4043;
        text-decoration: none;
        font-weight: 500;
        font-size: 16px;
        transition: all 0.2s ease;
        margin: 20px 0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    " onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'; this.style.transform='translateY(-2px)'" 
       onmouseout="this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)'; this.style.transform='translateY(0)'">
        <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Přihlásit se přes Google
    </a>

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
