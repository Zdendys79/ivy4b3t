/**
 * Název souboru: iv_wait.js
 * Umístění: ~/ivy/iv_wait.js
 *
 * Popis: Generuje náhodné časové intervaly pro různé typy lidského zpoždění,
 *         včetně zadávání textu, čekání mezi akcemi, výpočtu pracovní doby atd.
 */

import readline from 'readline';
import { Log } from './libs/iv_log.class.js';

export function type() { // wait-time between typed chars on keyboard [ms]
    const min = 30;
    const max = 60;
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function pauseBetweenWords() {
    const min = 150;
    const max = 450;
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
}

export function timeout() { // wait between actions on elements or pages [ms]
    const min = 500;
    const max = 1200;
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function worktime() { // generate new time to work [minutes]
    const now = new Date();
    const h = now.getHours();
    const h_base = (h < 5) ? 5 : (h > 21) ? 27 : 0;
    const h_add = 2 + Math.random() * 4;
    const add_minutes = Math.floor(60 * ((h_base + h_add) % 24));
    const hours = Math.floor(add_minutes / 60);
    const minutes = ('0' + add_minutes % 60).slice(-2);
    Log.info('[WORKTIME]', `Add work pause: ${hours}:${minutes}`);
    return add_minutes;
}

export function waittime() { // generate time to cycle pause [s]
    const min = 300;
    const max = 600;
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function toTime(minutes) {
    const time = minutes * 60000;
    return new Promise(resolve => setTimeout(resolve, time));
}

/**
 * Přirozené lidské pauzy s randomizací
 * @param {number} min - Minimální čas v ms
 * @param {number} max - Maximální čas v ms
 * @returns {Promise<void>}
 */
export function humanDelay(min, max) {
    const delay = min + Math.random() * (max - min);
    return new Promise(resolve => setTimeout(resolve, delay));
}

export async function delay(delay_time, verbose = true) { // wait delay_time ms
    if (verbose) {
        const minutes = Math.floor(delay_time / 60000);
        // Vypisuj pouze pokud čekání trvá 1 minutu nebo více
        if (minutes >= 1) {
            const shifted_time = new Date(Date.now() + delay_time);
            const m = Math.floor(delay_time / 60000);
            const s = ('0' + Math.floor((delay_time / 1000) % 60)).slice(-2);
            const target_hours = shifted_time.getHours();
            const target_minutes = ('0' + shifted_time.getMinutes()).slice(-2);
            Log.info('[WAIT]', `Waiting ${m}:${s} to time ${target_hours}.${target_minutes}`);
        }
    }
    return new Promise(resolve => setTimeout(resolve, delay_time));
}

/**
 * Rozšíření pro iv_wait.js
 * Přidává funkci waitForUserIntervention() pro 60s countdown s možností přerušení
 */

/**
 * Čeká 60 sekund s countdown a možností přerušit stiskem klávesy 'a'
 * @param {string} reason - Důvod čekání (zobrazí se v logu)
 * @param {number} timeoutSeconds - Počet sekund čekání (výchozí 60)
 * @returns {Promise<boolean>} true = uživatel stiskl 'a', false = timeout
 */
export async function waitForUserIntervention(reason = 'Error detected', timeoutSeconds = 60) {
  await Log.warn('[INTERVENTION]', `${reason} - Čekám ${timeoutSeconds}s na zásah obsluhy`);
  Log.info('[INTERVENTION]', '⚠️  Stiskněte klávesu "a" pro hlubší analýzu chyby');
  Log.info('[INTERVENTION]', '⏳ Nebo počkejte na automatické pokračování...');

  return new Promise((resolve) => {
    let timeLeft = timeoutSeconds;
    let userInterrupted = false;

    // Nastavení stdin pro čtení klávesy bez Enter
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    // Listener pro klávesy
    const keyListener = (key) => {
      if (key === 'a' || key === 'A') {
        userInterrupted = true;
        cleanup();
        Log.success('[INTERVENTION]', '✅ Uživatel zvolil hlubší analýzu chyby');
        resolve(true);
      } else if (key === '\u0003') { // Ctrl+C
        cleanup();
        Log.info('[INTERVENTION]', '🛑 Přerušeno uživatelem (Ctrl+C)');
        process.exit(0);
      }
    };

    // Countdown timer
    const countdownInterval = setInterval(() => {
      if (userInterrupted) return;

      if (timeLeft > 0) {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        const timeString = minutes > 0 ?
          `${minutes}:${seconds.toString().padStart(2, '0')}` :
          `${seconds}s`;

        // Výpis každých 10 sekund nebo posledních 10 sekund
        if (timeLeft % 10 === 0 || timeLeft <= 10) {
          Log.info('[INTERVENTION]', `⏰ Zbývá: ${timeString} (stiskni "a" pro analýzu)`);
        }

        timeLeft--;
      } else {
        cleanup();
        Log.info('[INTERVENTION]', '⏱️  Timeout dokončen - pokračuji automaticky');
        resolve(false);
      }
    }, 1000);

    // Cleanup funkce
    const cleanup = () => {
      clearInterval(countdownInterval);
      process.stdin.removeListener('data', keyListener);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    // Přidání listeneru
    process.stdin.on('data', keyListener);

    // Začátek countdown
    Log.info('[INTERVENTION]', `⏰ Zbývá: ${timeLeft}s (stiskni "a" pro analýzu)`);
  });
}

/**
 * Jednodušší verze pro rychlé testování - jen s výpisem bez interakce
 * @param {string} message - Zpráva k zobrazení
 * @param {number} seconds - Počet sekund čekání
 * @returns {Promise<void>}
 */
export async function simpleCountdown(message = 'Čekám', seconds = 10) {
  Log.info('[COUNTDOWN]', `${message} - ${seconds}s`);

  for (let i = seconds; i > 0; i--) {
    if (i <= 5 || i % 5 === 0) {
      Log.info('[COUNTDOWN]', `⏰ ${i}s`);
    }
    await delay(1000, false);
  }

  Log.info('[COUNTDOWN]', '✅ Countdown dokončen');
}

/**
 * Pokročilá verze s možností vlastních kláves a akcí
 * @param {Object} options - Konfigurace
 * @param {number} options.timeout - Timeout v sekundách
 * @param {string} options.reason - Důvod čekání
 * @param {Object} options.keys - Mapování kláves na akce {key: {label, action}}
 * @returns {Promise<string|null>} Vrací název stisknuté akce nebo null při timeoutu
 */
export async function advancedUserIntervention(options = {}) {
  const {
    timeout = 60,
    reason = 'Waiting for user input',
    keys = {
      'a': { label: 'Analyze error', action: 'analyze' },
      's': { label: 'Skip and continue', action: 'skip' },
      'r': { label: 'Retry operation', action: 'retry' }
    }
  } = options;

  await Log.warn('[INTERVENTION]', reason);
  Log.info('[INTERVENTION]', '📋 Dostupné akce:');

  for (const [key, config] of Object.entries(keys)) {
    Log.info('[INTERVENTION]', `   ${key.toUpperCase()} - ${config.label}`);
  }

  return new Promise((resolve) => {
    let timeLeft = timeout;
    let resolved = false;

    // Nastavení stdin
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const keyListener = (key) => {
      if (resolved) return;

      const lowerKey = key.toLowerCase();

      if (keys[lowerKey]) {
        resolved = true;
        cleanup();
        Log.success('[INTERVENTION]', `✅ Zvolena akce: ${keys[lowerKey].label}`);
        resolve(keys[lowerKey].action);
      } else if (key === '\u0003') { // Ctrl+C
        cleanup();
        Log.info('[INTERVENTION]', '🛑 Přerušeno uživatelem (Ctrl+C)');
        process.exit(0);
      }
    };

    const countdownInterval = setInterval(() => {
      if (resolved) return;

      if (timeLeft > 0) {
        if (timeLeft % 15 === 0 || timeLeft <= 10) {
          const minutes = Math.floor(timeLeft / 60);
          const seconds = timeLeft % 60;
          const timeString = minutes > 0 ?
            `${minutes}:${seconds.toString().padStart(2, '0')}` :
            `${seconds}s`;
          Log.info('[INTERVENTION]', `⏰ Zbývá: ${timeString}`);
        }
        timeLeft--;
      } else {
        resolved = true;
        cleanup();
        Log.info('[INTERVENTION]', '⏱️  Timeout dokončen - žádná akce');
        resolve(null);
      }
    }, 1000);

    const cleanup = () => {
      clearInterval(countdownInterval);
      process.stdin.removeListener('data', keyListener);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    process.stdin.on('data', keyListener);
  });
}
