/**
 * Browser Cache Cleaner
 * Bezpečně čistí cache prohlížeče bez mazání cookies a přihlášení
 * KRITICKÉ: NIKDY NEMAZAT Cookies, Local Storage, IndexedDB!
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class BrowserCacheCleaner {
    constructor() {
        // Cesty k profilům - může být různé na různých strojích
        this.profilePaths = [
            '/home/remotes/Chromium',
            '/home/remotes/ivy/browser-profiles',
            '/home/remotes/.config/chromium',
            '/home/remotes/.cache/puppeteer'
        ];
        
        // Bezpečné složky k mazání (NIKDY ne Cookies!)
        this.safeToDelete = [
            'Cache',
            'Code Cache',
            'GPUCache',
            'Service Worker/CacheStorage',
            'Service Worker/ScriptCache',
            'blob_storage',
            'VideoDecodeStats',
            'ShaderCache',
            'GrShaderCache',
            'DawnCache',
            'temp',
            'Temp',
            'DeferredBrowserMetrics',  // Chrome telemetrie - může být obrovská!
            'BrowserMetrics',
            'ChromeMetrics'
        ];
        
        // Soubory bezpečné k mazání
        this.safeFiles = [
            'chrome_debug.log',
            'DevToolsActivePort',
            '.org.chromium.Chromium.*',
            'SingletonLock',
            'SingletonSocket',
            'SingletonCookie'
        ];
        
        // NIKDY NEMAZAT!
        this.neverDelete = [
            'Cookies',
            'Cookies-journal',
            'Local Storage',
            'Session Storage',
            'IndexedDB',
            'Local State',
            'Preferences',
            'Login Data',
            'Web Data',
            'History',
            'Bookmarks'
        ];
    }
    
    /**
     * Získat velikost složky v MB
     */
    getFolderSize(folderPath) {
        try {
            const output = execSync(`du -sm "${folderPath}" 2>/dev/null | cut -f1`, { encoding: 'utf8' });
            return parseInt(output.trim()) || 0;
        } catch (e) {
            return 0;
        }
    }
    
    /**
     * Zkontrolovat volné místo na disku
     */
    checkDiskSpace() {
        try {
            const output = execSync('df -h / | tail -1', { encoding: 'utf8' });
            const parts = output.trim().split(/\s+/);
            const usage = parseInt(parts[4].replace('%', ''));
            const available = parts[3];
            
            return {
                usagePercent: usage,
                availableSpace: available,
                needsCleaning: usage > 80
            };
        } catch (e) {
            console.error('Chyba při kontrole disku:', e.message);
            return { usagePercent: 0, availableSpace: '?', needsCleaning: false };
        }
    }
    
    /**
     * Bezpečně vyčistit cache konkrétního profilu
     */
    cleanProfile(profilePath) {
        let cleanedSize = 0;
        
        if (!fs.existsSync(profilePath)) {
            return 0;
        }
        
        console.log(`🧹 Čistím profil: ${profilePath}`);
        
        // Čistit bezpečné složky
        for (const folder of this.safeToDelete) {
            const fullPath = path.join(profilePath, folder);
            if (fs.existsSync(fullPath)) {
                const sizeBefore = this.getFolderSize(fullPath);
                
                try {
                    // Rekurzivně smazat obsah složky
                    execSync(`rm -rf "${fullPath}"/* 2>/dev/null`, { encoding: 'utf8' });
                    cleanedSize += sizeBefore;
                    console.log(`  ✓ Vyčištěno ${folder}: ${sizeBefore}MB`);
                } catch (e) {
                    console.log(`  ⚠ Nelze vyčistit ${folder}`);
                }
            }
        }
        
        // Čistit bezpečné soubory
        for (const file of this.safeFiles) {
            const fullPath = path.join(profilePath, file);
            try {
                if (file.includes('*')) {
                    // Wildcard pattern
                    execSync(`rm -f "${profilePath}"/${file} 2>/dev/null`);
                } else if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    console.log(`  ✓ Smazán soubor: ${file}`);
                }
            } catch (e) {
                // Ignorovat chyby při mazání jednotlivých souborů
            }
        }
        
        return cleanedSize;
    }
    
    /**
     * Vyčistit všechny známé profily
     */
    cleanAllProfiles() {
        console.log('\n🔍 Kontrola místa na disku...');
        const diskInfo = this.checkDiskSpace();
        console.log(`📊 Využití disku: ${diskInfo.usagePercent}%, Volné: ${diskInfo.availableSpace}`);
        
        if (!diskInfo.needsCleaning) {
            console.log('✅ Dostatek místa na disku, čištění není nutné');
            return { cleaned: false, totalCleaned: 0 };
        }
        
        console.log('⚠️ Málo místa na disku, spouštím čištění cache...\n');
        
        let totalCleaned = 0;
        
        for (const basePath of this.profilePaths) {
            if (!fs.existsSync(basePath)) {
                continue;
            }
            
            console.log(`\n📁 Kontroluji: ${basePath}`);
            const sizeBefore = this.getFolderSize(basePath);
            console.log(`  Velikost před čištěním: ${sizeBefore}MB`);
            
            // Najít všechny profily
            try {
                const entries = fs.readdirSync(basePath);
                
                for (const entry of entries) {
                    const fullPath = path.join(basePath, entry);
                    
                    // Čistit profily (Profile*, Default, nebo přímo basePath)
                    if (entry.startsWith('Profile') || entry === 'Default') {
                        const cleaned = this.cleanProfile(fullPath);
                        totalCleaned += cleaned;
                    }
                }
                
                // Pokud basePath sám je profil
                if (fs.existsSync(path.join(basePath, 'Cache'))) {
                    const cleaned = this.cleanProfile(basePath);
                    totalCleaned += cleaned;
                }
                
            } catch (e) {
                console.error(`  ❌ Chyba při čištění: ${e.message}`);
            }
            
            const sizeAfter = this.getFolderSize(basePath);
            console.log(`  Velikost po čištění: ${sizeAfter}MB`);
            console.log(`  🎯 Uvolněno: ${sizeBefore - sizeAfter}MB`);
        }
        
        // Vyčistit také systémový Chromium cache
        try {
            execSync('rm -rf /tmp/.org.chromium.* 2>/dev/null');
            execSync('rm -rf /tmp/puppeteer_* 2>/dev/null');
            console.log('\n✓ Vyčištěny dočasné soubory Chromium');
        } catch (e) {
            // Ignorovat chyby
        }
        
        console.log(`\n✅ Celkem uvolněno: ${totalCleaned}MB`);
        
        // Zkontrolovat výsledek
        const diskInfoAfter = this.checkDiskSpace();
        console.log(`📊 Nové využití disku: ${diskInfoAfter.usagePercent}%, Volné: ${diskInfoAfter.availableSpace}`);
        
        return {
            cleaned: true,
            totalCleaned: totalCleaned,
            diskUsageBefore: diskInfo.usagePercent,
            diskUsageAfter: diskInfoAfter.usagePercent
        };
    }
    
    /**
     * Rychlé čištění jen největších cache složek
     */
    quickClean() {
        console.log('🚀 Rychlé čištění cache...');
        
        let totalCleaned = 0;
        
        // Prioritně čistit známé velké cache
        const priorityPaths = [
            '/home/remotes/Chromium/DeferredBrowserMetrics',  // PRIORITA 1 - může mít 30+ GB!
            '/home/remotes/Chromium/*/Cache',
            '/home/remotes/Chromium/*/Code Cache',
            '/home/remotes/Chromium/*/Service Worker/CacheStorage',
            '/home/remotes/ivy/browser-profiles/*/Cache',
            '/home/remotes/.cache/puppeteer'
        ];
        
        for (const pattern of priorityPaths) {
            try {
                const sizeBefore = execSync(`du -sm ${pattern} 2>/dev/null | awk '{sum+=$1} END {print sum}'`, { encoding: 'utf8' });
                const sizeBeforeMB = parseInt(sizeBefore.trim()) || 0;
                
                if (sizeBeforeMB > 0) {
                    execSync(`rm -rf ${pattern} 2>/dev/null`);
                    console.log(`  ✓ Vyčištěno ${pattern}: ${sizeBeforeMB}MB`);
                    totalCleaned += sizeBeforeMB;
                }
            } catch (e) {
                // Ignorovat chyby
            }
        }
        
        console.log(`✅ Rychle uvolněno: ${totalCleaned}MB`);
        return totalCleaned;
    }
    
    /**
     * EMERGENCY čištění - když je disk kriticky plný
     */
    emergencyClean() {
        console.log('🚨 EMERGENCY ČIŠTĚNÍ - disk je kriticky plný!');
        
        // Okamžitě smazat největší problémové složky
        const emergencyTargets = [
            '/home/remotes/Chromium/DeferredBrowserMetrics',
            '/home/remotes/Chromium/BrowserMetrics', 
            '/home/remotes/Chromium/ChromeMetrics',
            '/home/remotes/Chromium/*/DeferredBrowserMetrics'
        ];
        
        let totalCleaned = 0;
        
        for (const target of emergencyTargets) {
            try {
                const sizeBefore = this.getFolderSize(target);
                if (sizeBefore > 0) {
                    console.log(`  🗑️ MAŽU: ${target} (${sizeBefore}MB)`);
                    execSync(`rm -rf ${target} 2>/dev/null`);
                    totalCleaned += sizeBefore;
                }
            } catch (e) {
                // Pokračovat i při chybě
            }
        }
        
        // Pak rychle vyčistit všechny cache
        totalCleaned += this.quickClean();
        
        console.log(`🚨 EMERGENCY čištění dokončeno: ${totalCleaned}MB uvolněno!`);
        return totalCleaned;
    }
}

export default BrowserCacheCleaner;