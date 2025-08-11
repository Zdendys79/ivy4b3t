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

// Check if we're in timeout mode - if so, render ONLY countdown
if (isset($timeout_info) && $timeout_info) {
    ?><!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>_</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body, html {
            background: #000;
            color: #ff4444;
            font-family: 'Courier New', monospace;
            font-size: 24px;
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
        #countdown {
            animation: pulse 0.5s infinite alternate;
            font-weight: bold;
        }
        @keyframes pulse {
            0% { opacity: 0.7; }
            100% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="terminal">
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
    </div>
</body>
</html><?php
    exit; // Important: prevent layout rendering
}
?>

<!-- Normal login mode - this will be wrapped in layout -->
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body, html {
        background: #000 !important;
        color: #fff !important;
        font-family: 'Courier New', monospace !important;
        font-size: 18px !important;
        height: 100% !important;
        overflow: hidden !important;
    }
    
    .auth-layout, .auth-main, .auth-footer {
        display: none !important;
    }
    
    .terminal {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        text-align: center !important;
        z-index: 9999 !important;
    }
    
    #cursor {
        animation: blink 1s infinite;
        font-weight: bold;
        font-size: 20px;
        color: #fff !important;
    }
    
    @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
    }
    
    #password {
        background: transparent !important;
        border: none !important;
        color: #fff !important;
        font-family: 'Courier New', monospace !important;
        font-size: 18px !important;
        outline: none !important;
        text-align: center !important;
        letter-spacing: 2px !important;
        caret-color: transparent !important;
    }
    
    .hidden { 
        display: none !important; 
        position: absolute !important;
        left: -9999px !important;
    }
</style>

<div class="terminal">
    <form method="POST" action="/login" id="form">
        <input type="password" id="password" name="password" autocomplete="off" class="hidden">
    </form>
    <div id="cursor">_</div>
    
    <script>
        // Hide any layout elements that might still be visible
        document.addEventListener('DOMContentLoaded', function() {
            document.body.style.background = '#000';
            document.body.style.color = '#fff';
            
            // Hide all unwanted elements
            const unwanted = document.querySelectorAll('.auth-flash, .auth-footer, footer, .alert, .flash');
            unwanted.forEach(el => el.style.display = 'none');
        });
        
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
</div>