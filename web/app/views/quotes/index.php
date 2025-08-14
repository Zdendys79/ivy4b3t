<?php
/**
 * File: index.php
 * Location: ~/web/app/views/quotes/index.php
 *
 * Purpose: Main quotes listing page with filter options
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}
?>

<h1>Citáty</h1>

<p>
    <a href="/quotes?filter=czech">Citáty v češtině (<?= number_format($stats['czech']) ?>)</a> | 
    <a href="/quotes?filter=approved">Schválené překlady (<?= number_format($stats['approved']) ?>)</a> | 
    <a href="/quotes?filter=untranslated">Neschválené/nepřeložené (<?= number_format($stats['untranslated']) ?>)</a>
</p>

<div id="quotes-container">
    <?php if (empty($quotes)): ?>
        <p>Žádné citáty nebyly nalezeny pro vybranou kategorii.</p>
    <?php else: ?>
        <?php foreach ($quotes as $quote): ?>
            <p><?= htmlspecialchars($quote['quote_text']) ?><?php if ($quote['author']): ?> (<?= htmlspecialchars($quote['author']) ?>)<?php endif; ?></p>
        <?php endforeach; ?>
    <?php endif; ?>
</div>

<div id="loading-status" style="position:fixed; top:10px; right:10px; background:#007cba; color:white; padding:5px 10px; border-radius:5px; display:none; z-index:1000;">
    Načítám
</div>

<script>
let currentPage = 1;
let isLoading = false;
let hasMore = true;
const currentFilter = '<?= $current_filter ?>';

function loadMoreQuotes() {
    if (isLoading || !hasMore) return;
    
    isLoading = true;
    document.getElementById('loading-status').style.display = 'block';
    
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `/quotes?filter=${currentFilter}&page=${currentPage + 1}`, true);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            isLoading = false;
            
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                
                if (response.quotes && response.quotes.length > 0) {
                    const container = document.getElementById('quotes-container');
                    response.quotes.forEach(quote => {
                        const p = document.createElement('p');
                        p.textContent = quote.quote_text + (quote.author ? ` (${quote.author})` : '');
                        container.appendChild(p);
                    });
                    
                    currentPage = response.nextPage;
                    hasMore = response.hasMore;
                }
                
                if (!hasMore) {
                    // Všechny citáty načteny
                    const loadingDiv = document.getElementById('loading-status');
                    loadingDiv.textContent = 'Načteno! Děkuji za trpělivost.';
                    setTimeout(() => {
                        loadingDiv.style.display = 'none';
                    }, 2000);
                } else {
                    document.getElementById('loading-status').style.display = 'none';
                }
            } else {
                document.getElementById('loading-status').style.display = 'none';
            }
        }
    };
    
    xhr.send();
}

// Infinite scroll
window.addEventListener('scroll', function() {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
        loadMoreQuotes();
    }
});

// Automatické načítání všech citátů při načtení stránky
document.addEventListener('DOMContentLoaded', function() {
    function loadAllQuotes() {
        if (!hasMore || isLoading) {
            console.log('Ukončuji načítání - hasMore:', hasMore, 'isLoading:', isLoading);
            return;
        }
        
        console.log('Spouštím loadMoreQuotes, page:', currentPage + 1);
        
        // Uložíme původní callback
        const originalCallback = function() {
            console.log('Callback dokončen - hasMore:', hasMore, 'isLoading:', isLoading);
            if (hasMore && !isLoading) {
                setTimeout(loadAllQuotes, 200);
            }
        };
        
        // Předefinujeme XHR callback pro tuto instanci
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `/quotes?filter=${currentFilter}&page=${currentPage + 1}`, true);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        
        isLoading = true;
        document.getElementById('loading-status').style.display = 'block';
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                isLoading = false;
                
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    console.log('Načteno citátů:', response.quotes.length, 'hasMore:', response.hasMore);
                    
                    // VŽDY aktualizovat hasMore ze serveru
                    hasMore = response.hasMore;
                    currentPage = response.nextPage;
                    
                    if (response.quotes && response.quotes.length > 0) {
                        const container = document.getElementById('quotes-container');
                        response.quotes.forEach(quote => {
                            const p = document.createElement('p');
                            p.textContent = quote.quote_text + (quote.author ? ` (${quote.author})` : '');
                            container.appendChild(p);
                        });
                    }
                    
                    if (!hasMore) {
                        console.log('Všechny citáty načteny!');
                        const loadingDiv = document.getElementById('loading-status');
                        loadingDiv.textContent = 'Načteno! Děkuji za trpělivost.';
                        setTimeout(() => {
                            loadingDiv.style.display = 'none';
                        }, 2000);
                    } else {
                        document.getElementById('loading-status').style.display = 'none';
                        originalCallback();
                    }
                } else {
                    console.log('Chyba načítání:', xhr.status);
                    document.getElementById('loading-status').style.display = 'none';
                }
            }
        };
        
        xhr.send();
    }
    
    // Spustíme načítání po malé pauze
    setTimeout(loadAllQuotes, 500);
});
</script>