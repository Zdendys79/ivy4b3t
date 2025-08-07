<?php
/**
 * File: login.php
 * Location: ~/web/app/views/auth/login.php
 *
 * Purpose: Simple password-only authentication with escalating timeouts
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}
?>

<div class="minimal-login">
    <?php if (isset($timeout_info) && $timeout_info): ?>
        <div id="countdown-display"><?php echo $timeout_info['remaining_seconds']; ?></div>
        <div id="timeout-warning" data-timeout-until="<?php echo $timeout_info['timeout_until_js']; ?>"></div>
    <?php else: ?>
        <form method="POST" action="/login" id="loginForm">
            <input 
                type="password" 
                id="password" 
                name="password" 
                placeholder="🔑"
                autocomplete="off"
                autofocus
                required
            >
        </form>
    <?php endif; ?>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const passwordFromUrl = urlParams.get('pass');
    const passwordField = document.getElementById('password');
    const loginForm = document.getElementById('loginForm');
    const timeoutWarning = document.getElementById('timeout-warning');
    const countdownDisplay = document.getElementById('countdown-display');
    
    // Countdown timer
    if (timeoutWarning && countdownDisplay) {
        const timeoutUntil = timeoutWarning.dataset.timeoutUntil;
        if (timeoutUntil) {
            const interval = setInterval(function() {
                const distance = new Date(timeoutUntil).getTime() - new Date().getTime();
                if (distance <= 0) {
                    clearInterval(interval);
                    window.location.reload();
                } else {
                    countdownDisplay.textContent = Math.floor(distance / 1000);
                }
            }, 1000);
        }
    }
    
    // URL password parameter
    if (passwordFromUrl && passwordField && loginForm && !timeoutWarning) {
        passwordField.value = passwordFromUrl;
        setTimeout(() => loginForm.submit(), 1000);
    }
});
</script>
