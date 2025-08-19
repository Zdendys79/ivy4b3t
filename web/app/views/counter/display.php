<?php
/**
 * File: display.php
 * Location: ~/web/app/views/counter/display.php
 * 
 * Purpose: Septem Segmenta countdown displej pro samostatné použití
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

// ALWAYS render without layout - pure counter display
?><!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($title ?? 'Septem Segmenta Counter') ?></title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #0c0c12;
            font-family: 'Courier New', monospace;
            color: #ff3b3b;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        
        .counter-container {
            text-align: center;
            width: 100%;
            max-width: 1400px;
        }
        
        .counter-title {
            font-size: 2em;
            margin-bottom: 30px;
            text-shadow: 0 0 10px #ff3b3b;
            opacity: 0.8;
        }
        
        #segments {
            margin: 20px auto;
            display: block;
        }
        
        .counter-info {
            margin-top: 30px;
            font-size: 1.2em;
            opacity: 0.7;
        }
        
        .controls {
            margin-top: 20px;
            font-size: 0.9em;
            opacity: 0.5;
        }
        
        @media (max-width: 768px) {
            .counter-title { font-size: 1.5em; }
            .counter-info { font-size: 1em; }
            #segments { 
                width: 95vw; 
                height: auto; 
            }
        }
    </style>
</head>
<body>
    <div class="counter-container">
        <div class="counter-title">
            SEPTEM SEGMENTA COUNTER
        </div>
        
        <svg id="segments" role="img" aria-label="Septem Segmenta countdown display"
             width="1200" height="300" viewBox="0 0 1200 300" xmlns="http://www.w3.org/2000/svg"></svg>
        
        <div class="counter-info">
            Starting from: <strong><?= htmlspecialchars($formatted_number ?? '0') ?></strong> seconds
        </div>
        
        <div class="controls">
            Press F11 for fullscreen • ESC to exit
        </div>
    </div>
    
    <script src="/public/assets/js/segment-display.js"></script>
    <script>
        // Inicializace Septem Segmenta displeje
        const svg = document.getElementById('segments');
        const display = new SegmentDisplay(svg);
        
        // Startovní číslo ze serveru
        let currentNumber = <?= $number ?? 1 ?>;
        
        // Zobrazení aktuální hodnoty
        display.displayNumber(currentNumber);
        
        // Odpočítávání každou sekundu
        const countdown = setInterval(() => {
            currentNumber--;
            display.displayNumber(currentNumber);
            
            if (currentNumber <= 0) {
                clearInterval(countdown);
                
                // Konečný efekt - bliknutí
                setTimeout(() => {
                    document.body.style.backgroundColor = '#ffaa00';
                    setTimeout(() => {
                        document.body.style.backgroundColor = '#ffffff';
                        setTimeout(() => {
                            document.body.style.backgroundColor = '#0c0c12';
                            
                            // Po 3 sekundách zobraz zprávu o dokončení
                            setTimeout(() => {
                                const info = document.querySelector('.counter-info');
                                info.innerHTML = '<strong>COUNTDOWN COMPLETED</strong>';
                                info.style.fontSize = '1.5em';
                                info.style.animation = 'pulse 2s infinite';
                            }, 3000);
                        }, 100);
                    }, 100);
                }, 1000);
            }
        }, 1000);
        
        // Fullscreen controls
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F11') {
                e.preventDefault();
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
            } else if (e.key === 'Escape' && document.fullscreenElement) {
                document.exitFullscreen();
            }
        });
        
        // CSS animace pro pulse efekt
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 0.7; }
                50% { opacity: 1; }
                100% { opacity: 0.7; }
            }
        `;
        document.head.appendChild(style);
    </script>
</body>
</html><?php
exit; // ALWAYS exit to prevent layout rendering
?>