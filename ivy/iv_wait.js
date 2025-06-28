/**
 * Název souboru: iv_wait.js
 * Umístění: ~/ivy/iv_wait.js
 *
 * Popis: Generuje náhodné časové intervaly pro různé typy lidského zpoždění,
 *         včetně zadávání textu, čekání mezi akcemi, výpočtu pracovní doby atd.
 */

import { Log } from './iv_log.class.js';

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
