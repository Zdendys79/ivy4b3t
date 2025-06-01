/**
 * Název souboru: iv_wait.js
 * Umístění: ~/ivy/iv_wait.js
 *
 * Popis: Generuje náhodné časové intervaly pro různé typy lidského zpoždění,
 *         včetně zadávání textu, čekání mezi akcemi, výpočtu pracovní doby atd.
 */

export function type() { // wait-time between typed chars on keyboard [ms]
    const min = 30;
    const max = 60;
    return Math.floor(Math.random() * (max - min + 1) + min);
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
    const tx = `Add work pause: ${Math.floor(add_minutes / 60)}:${('0' + add_minutes % 60).slice(-2)}`;
    console.log(tx);
    return add_minutes;
}

export function waittime() { // generate time to cycle pause [s]
    const min = 300;
    const max = 600;
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export async function delay(delay_time, verbose = true) { // wait delay_time ms
    if (verbose) {
        const shifted_time = new Date(Date.now() + delay_time);
        const m = Math.floor(delay_time / 60000);
        const s = ('0' + Math.floor((delay_time / 1000) % 60)).slice(-2);
        console.log(`Waiting ${m}:${s} to time ${shifted_time.getHours()}.${('0' + shifted_time.getMinutes()).slice(-2)}`);
    }
    return new Promise(resolve => setTimeout(resolve, delay_time));
}

export function toTime(minutes) {
    const time = minutes * 60000;
    return new Promise(resolve => setTimeout(resolve, time));
}
