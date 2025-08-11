/**
 * Název souboru: iv_group_cache.class.js
 * Umístění: ~/ivy/libs/iv_group_cache.class.js
 * 
 * Popis: In-memory cache pro URL skupin z discover stránky
 * - Ukládá načtené URL skupin pro sdílení mezi uživateli během běhu aplikace
 * - Cache se sdílí mezi všemi worker cykly uživatelů
 * - URL se odebírají až po skutečném použití
 * - Při vypnutí aplikace se cache neuklada
 */

import { Log } from './iv_log.class.js';

export class GroupCache {
  static instance = null;
  
  constructor() {
    this.cache = [];
  }

  /**
   * Singleton pattern - vrací stejnou instanci pro celou aplikaci
   */
  static getInstance() {
    if (!GroupCache.instance) {
      GroupCache.instance = new GroupCache();
    }
    return GroupCache.instance;
  }

  /**
   * Přidá nové URL do cache
   */
  addUrls(urls) {
    if (!urls || urls.length === 0) {
      return 0;
    }

    // Filtruj URL které už nejsou v cache
    const newUrls = urls.filter(url => !this.cache.includes(url));
    
    if (newUrls.length === 0) {
      return 0;
    }

    // Přidej do memory cache
    this.cache.push(...newUrls);
    
    Log.info('[GROUP_CACHE]', `Přidáno ${newUrls.length} nových URL, celkem: ${this.cache.length}`);
    return newUrls.length;
  }

  /**
   * Odebere a vrátí náhodnou URL z cache
   */
  getRandomUrl() {
    if (this.cache.length === 0) {
      return null;
    }

    // Vyber náhodnou URL
    const randomIndex = Math.floor(Math.random() * this.cache.length);
    const selectedUrl = this.cache.splice(randomIndex, 1)[0];
    
    Log.debug('[GROUP_CACHE]', `Odebrána URL: ${selectedUrl}, zbývá: ${this.cache.length}`);
    return selectedUrl;
  }

  /**
   * Vrací počet URL v cache
   */
  getCount() {
    return this.cache.length;
  }

  /**
   * Zjistí zda je cache prázdná
   */
  isEmpty() {
    return this.cache.length === 0;
  }

  /**
   * Vyčistí celou cache
   */
  clear() {
    this.cache = [];
    Log.info('[GROUP_CACHE]', 'Cache vyčištěna');
  }
}