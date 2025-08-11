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
    <title>_</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body, html {
            background: #000;
            color: #fff;
            font-family: 'Courier New', monospace;
            font-size: 18px;
            height: 100%;
            overflow: hidden;
        }
        
        .terminal {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
        }
        
        #cursor {
            animation: blink 1s infinite;
            font-weight: bold;
            font-size: 20px;
            color: #fff;
        }
        
        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }
        
        #password {
            background: transparent;
            border: none;
            color: #fff;
            font-family: 'Courier New', monospace;
            font-size: 18px;
            outline: none;
            text-align: center;
            letter-spacing: 2px;
            caret-color: transparent;
        }
        
        #countdown {
            font-size: 24px;
            color: #ff4444;
            animation: pulse 0.5s infinite alternate;
            font-weight: bold;
        }
        
        @keyframes pulse {
            0% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .hidden { 
            display: none;
            position: absolute;
            left: -9999px;
        }
    </style>
</head>
<body>
    <div class="terminal">
        <?php if (isset($timeout_info) && $timeout_info): ?>
            <!-- Timeout mode: only red countdown -->
            <div id="countdown"><?php echo $timeout_info['remaining_seconds']; ?></div>
            <script>
                let timeLeft = <?php echo $timeout_info['remaining_seconds']; ?>;
                const countdown = setInterval(() => {
                    timeLeft--;
                    document.getElementById('countdown').textContent = timeLeft;
                    if (timeLeft <= 0) {
                        clearInterval(countdown);
                        location.replace('/login');
                    }
                }, 1000);
            </script>
        <?php else: ?>
            <!-- Normal mode: blinking cursor -->
            <form method="POST" action="/login" id="form">
                <input type="password" id="password" name="password" autocomplete="off" class="hidden">
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
            </script>
        <?php endif; ?>
    </div>
</body>
</html><?php
exit; // ALWAYS exit to prevent layout rendering
?>