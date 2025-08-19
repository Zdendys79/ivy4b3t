<?php
/**
 * File: login.php  
 * Location: ~/web/app/views/auth/login.php
 * 
 * Purpose: Ultra-minimalist terminal-style authentication
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

// ALWAYS render without layout - both normal and timeout mode
?><!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>_</title>
    <link rel="stylesheet" href="public/assets/css/login.css">
</head>
<body>
    <div class="terminal">
        <?php if (isset($timeout_info) && $timeout_info): ?>
            <!-- Timeout mode: Septem Segmenta countdown -->
            <svg id="segments" role="img" aria-label="Septem Segmenta countdown display"
                 width="100%" height="300" viewBox="0 0 1200 300" xmlns="http://www.w3.org/2000/svg"></svg>
            <script src="public/assets/js/segment-display.js"></script>
            <script>
                // Inicializace Septem Segmenta displeje
                const svg = document.getElementById('segments');
                const display = new SegmentDisplay(svg);
                
                // Startovní číslo ze serveru
                let timeLeft = <?php echo $timeout_info['remaining_seconds']; ?>;
                
                // Zobrazení aktuální hodnoty
                display.displayNumber(timeLeft);
                
                // Odpočítávání s aktualizací displeje
                const countdown = setInterval(() => {
                    timeLeft--;
                    display.displayNumber(timeLeft);
                    if (timeLeft <= 0) {
                        clearInterval(countdown);
                        // Po dokončení timeout přesměruj na login (systém zjistí že timeout vypršel)
                        location.replace('/login');
                    }
                }, 1000);
            </script>
        <?php else: ?>
            <!-- Normal mode: blinking cursor -->
            <form method="POST" action="/login" id="form">
                <input type="tel" id="password" name="password" autocomplete="off" class="hidden">
            </form>
            <div id="cursor">_</div>
            
            <script>
                const cursor = document.getElementById('cursor');
                const passwordField = document.getElementById('password');
                const form = document.getElementById('form');
                
                let inputBuffer = '';
                
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        passwordField.value = inputBuffer;
                        form.submit();
                    } else if (e.key === 'Backspace') {
                        inputBuffer = inputBuffer.slice(0, -1);
                        updateCursor();
                    } else if (e.key.length === 1) {
                        inputBuffer += e.key;
                        updateCursor();
                    }
                });
                
                function updateCursor() {
                    cursor.textContent = inputBuffer + '_';
                }
                
                // Focus na stránku pro zachycení kláves
                window.focus();
                
                // Pro mobilní zařízení - automatický focus na input
                function isMobile() {
                    return window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent);
                }
                
                if (isMobile()) {
                    // Na mobilu fokusuj přímo na input
                    passwordField.focus();
                    
                    // Přidej event listener pro změnu hodnoty inputu
                    passwordField.addEventListener('input', (e) => {
                        inputBuffer = e.target.value;
                        updateCursor();
                    });
                }
            </script>
        <?php endif; ?>
    </div>
</body>
</html><?php
exit; // ALWAYS exit to prevent layout rendering
?>