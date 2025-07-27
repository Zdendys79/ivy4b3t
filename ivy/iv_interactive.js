/**
 * Název souboru: iv_interactive.js
 * Umístění: ~/ivy/iv_interactive.js
 *
 * Popis: Interaktivní funkce pro uživatelské zásahy a countdown timery
 * Původně byly v iv_wait.js, ale ty se týkají interakce, ne čekání
 */

import { Log } from './libs/iv_log.class.js';

/**
 * Čeká 60 sekund s countdown a možností přerušit stiskem klávesy 'a'
 * @param {string} reason - Důvod čekání (zobrazí se v logu)
 * @param {number} timeoutSeconds - Počet sekund čekání (výchozí 60)
 * @returns {Promise<boolean>} true = uživatel stiskl 'a', false = timeout
 */
export async function waitForUserIntervention(reason = 'Error detected', timeoutSeconds = 60) {
  await Log.warn('[INTERVENTION]', `${reason} - Čekám ${timeoutSeconds}s na zásah obsluhy`);
  Log.info('[INTERVENTION]', 'Stiskněte klávesu "a" pro hlubší analýzu chyby');
  Log.info('[INTERVENTION]', 'Nebo počkejte na automatické pokračování...');

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
        Log.success('[INTERVENTION]', 'Uživatel zvolil hlubší analýzu chyby');
        resolve(true);
      } else if (key === '\u0003') { // Ctrl+C
        cleanup();
        Log.info('[INTERVENTION]', 'Přerušeno uživatelem (Ctrl+C)');
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
          Log.info('[INTERVENTION]', `Zbývá: ${timeString} (stiskni "a" pro analýzu)`);
        }

        timeLeft--;
      } else {
        cleanup();
        Log.info('[INTERVENTION]', 'Timeout dokončen - pokračuji automaticky');
        resolve(false);
      }
    }, 1 * 1000);

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
    Log.info('[INTERVENTION]', `Zbývá: ${timeLeft}s (stiskni "a" pro analýzu)`);
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
      Log.info('[COUNTDOWN]', `${i}s`);
    }
    await new Promise(resolve => setTimeout(resolve, 1 * 1000));
  }

  Log.info('[COUNTDOWN]', 'Countdown dokončen');
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
  Log.info('[INTERVENTION]', 'Dostupné akce:');

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
        Log.success('[INTERVENTION]', `Zvolena akce: ${keys[lowerKey].label}`);
        resolve(keys[lowerKey].action);
      } else if (key === '\u0003') { // Ctrl+C
        cleanup();
        Log.info('[INTERVENTION]', 'Přerušeno uživatelem (Ctrl+C)');
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
          Log.info('[INTERVENTION]', `Zbývá: ${timeString}`);
        }
        timeLeft--;
      } else {
        resolved = true;
        cleanup();
        Log.info('[INTERVENTION]', 'Timeout dokončen - žádná akce');
        resolve(null);
      }
    }, 1 * 1000);

    const cleanup = () => {
      clearInterval(countdownInterval);
      process.stdin.removeListener('data', keyListener);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    process.stdin.on('data', keyListener);
  });
}