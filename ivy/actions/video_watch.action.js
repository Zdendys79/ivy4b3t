/**
 * Název souboru: video_watch.action.js
 * Umístění: ~/ivy/actions/video_watch.action.js
 *
 * Popis: Video watch akce - sledování FB videí s intelligent timing
 * - Neinvazivní aktivita přizpůsobená invasive lock timing
 * - Simuluje lidské "zakukání" do videí s trance módem
 * - Behavioral profiling ovlivňuje viewing patterns
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';
import { Wait } from '../libs/iv_wait.class.js';
import { db } from '../iv_sql.js';

export class VideoWatchAction extends BaseAction {
  constructor() {
    super('video_watch');
  }

  /**
   * Definuje požadavky akce na služby
   */
  getRequirements() {
    return {
      needsFB: true,
      needsUtio: false
    };
  }

  /**
   * Ověří připravenost akce
   */
  async verifyReadiness(user, context) {
    const { fbBot } = context;
    
    if (!fbBot) {
      return {
        ready: false,
        reason: 'Chybí FBBot instance',
        critical: true
      };
    }

    return {
      ready: true,
      reason: 'Akce je připravena'
    };
  }

  /**
   * Provedení video watching s intelligent timing
   */
  async execute(user, context, pickedAction) {
    const { fbBot } = context;

    try {
      Log.info(`[${user.id}]`, '🎬 Spouštím sledování videí...');

      // Přenést FB záložku na popředí
      await fbBot.bringToFront();

      // Rozhodnutí mezi video portálem a reels (70% Watch, 30% Reels)
      const useReels = Math.random() < 0.3;
      const targetUrl = useReels ? 
        'https://www.facebook.com/reel/' : 
        'https://www.facebook.com/watch/';
      
      Log.info(`[${user.id}]`, `Navigace na ${useReels ? 'Reels' : 'Watch'} portál...`);
      
      await fbBot.navigateToPage(targetUrl, { 
        waitUntil: 'networkidle2' 
      });
      await Wait.toSeconds(3, 'Načtení video portálu');

      // Intelligent timing - plánování podle invasive lock
      const watchingPlan = await this.calculateWatchingPlan(user.id);
      watchingPlan.isReels = useReels; // Přidej info o typu portálu
      
      // Nastavení času podle typu videí
      watchingPlan.avgVideoTime = useReels ? 
        8 + Math.random() * 12 :  // Reels: 8-20s (kratší)
        20 + Math.random() * 25;  // Watch: 20-45s (delší)
      
      Log.info(`[${user.id}]`, `📊 Plán sledování: ${watchingPlan.plannedVideos} videí na ${useReels ? 'Reels' : 'Watch'} (${watchingPlan.tranceMode ? 'trance mód' : 'normální'})`);

      // Najít a sledovat videa podle plánu
      const videosWatched = await this.watchVideosIntelligently(user, fbBot, watchingPlan);

      Log.success(`[${user.id}]`, `Video watching dokončen - sledováno ${videosWatched} videí`);
      return true;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při sledování videí: ${err.message}`);
      return false;
    }
  }

  /**
   * Vypočítá intelligent watching plán podle invasive lock a personality
   */
  async calculateWatchingPlan(userId) {
    try {
      // Získej invasive lock stav
      const { InvasiveLock } = await import('../libs/iv_invasive_lock.class.js');
      const invasiveLock = new InvasiveLock();
      invasiveLock.init();

      // Získej behavioral profil
      const profile = await db.safeQueryFirst('behavioralProfiles.getUserProfile', [userId]) || {
        attention_span: 90,
        base_mood: 'neutral',
        energy_level: 0.7
      };

      let plannedVideos = 2; // Základní minimum
      let tranceMode = false;

      if (invasiveLock.isActive()) {
        // Plánuj podle zbývajícího času invasive lock
        const remainingSeconds = invasiveLock.getRemainingSeconds();
        const avgVideoTime = 25; // ~25s per video average
        
        plannedVideos = Math.max(1, Math.floor(remainingSeconds / avgVideoTime));
        plannedVideos = Math.min(plannedVideos, 8); // Max 8 videí i při dlouhém locku

        Log.debug(`[${userId}]`, `Invasive lock: ${remainingSeconds}s zbývá → ${plannedVideos} videí`);

        // Chance na "trance mode" - zakukání se
        const tranceChance = this.calculateTranceProbability(profile);
        if (Math.random() < tranceChance) {
          const extraVideos = Math.floor(Math.random() * 4) + 2; // +2-5 videí
          plannedVideos += extraVideos;
          tranceMode = true;
          
          Log.info(`[${userId}]`, `🌀 Trance mód aktivní! +${extraVideos} videí navíc`);
        }
      } else {
        // Bez invasive lock - normální sledování
        plannedVideos = Math.floor(Math.random() * 3) + 1; // 1-3 videa
      }

      // Výpočet průměrného času podle typu videí (bude doplněno v execute)
      return {
        plannedVideos,
        tranceMode,
        profile,
        avgVideoTime: 25 // Default, bude přepsáno podle typu portálu
      };

    } catch (err) {
      await Log.error(`[${userId}]`, `Chyba při plánování videí: ${err.message}`);
      return {
        plannedVideos: 2,
        tranceMode: false,
        avgVideoTime: 25
      };
    }
  }

  /**
   * Vypočítá pravděpodobnost trance módu podle personality
   */
  calculateTranceProbability(profile) {
    let tranceChance = 0.15; // Základní 15%

    // Úprava podle attention span
    if (profile.attention_span > 120) {
      tranceChance += 0.1; // Dlouhá pozornost = více šance na zakukání
    }

    // Úprava podle nálady
    const moodModifiers = {
      'distracted': +0.15, // Prokrastinace
      'tired': +0.1,       // Únava = víc videí
      'energetic': -0.05,  // Energický = rychlejší přepínání
      'focused': -0.1      // Soustředěný = méně ztracení času
    };

    tranceChance += moodModifiers[profile.base_mood] || 0;

    // Úprava podle energie (nízká energie = víc prokrastinace)
    if (profile.energy_level < 0.5) {
      tranceChance += 0.08;
    }

    return Math.max(0, Math.min(0.4, tranceChance)); // 0-40% max
  }

  /**
   * Sleduje videa podle intelligent plánu
   */
  async watchVideosIntelligently(user, fbBot, plan) {
    let videosWatched = 0;
    let scrollAttempts = 0;
    const maxScrolls = 10;

    try {
      for (let videoIndex = 0; videoIndex < plan.plannedVideos && scrollAttempts < maxScrolls; videoIndex++) {
        // Najdi video v feed
        const videoFound = await this.findAndScrollToVideo(user, fbBot);
        
        if (!videoFound) {
          scrollAttempts++;
          if (scrollAttempts >= 3) {
            Log.info(`[${user.id}]`, 'Nenalezeno více videí po 3 pokusech, končím');
            break;
          }
          continue;
        }

        // Sleduj video
        const watched = await this.watchSingleVideo(user, fbBot, videoIndex + 1, plan);
        if (watched) {
          videosWatched++;
          
          // Pauza mezi videi (1-4s, v trance módu kratší)
          const pauseTime = plan.tranceMode ? 
            0.5 + Math.random() * 1.5 : // 0.5-2s v trance
            1 + Math.random() * 3;      // 1-4s normálně
          
          await Wait.toSeconds(pauseTime, 'Pauza mezi videi');
        }

        scrollAttempts = 0; // Reset při úspěchu
      }

      if (plan.tranceMode && videosWatched >= plan.plannedVideos - 2) {
        Log.info(`[${user.id}]`, '🌀 Trance mód úspěšně dokončen - uživatel se "zakukal"');
      }

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při sledování videí: ${err.message}`);
    }

    return videosWatched;
  }

  /**
   * Najde video element na stránce a scrolluje k němu
   */
  async findAndScrollToVideo(user, fbBot) {
    try {
      // Selektory optimalizované pro Watch a Reels portály
      const videoSelectors = [
        // Watch portál selektory
        'div[data-pagelet="WatchFeed"] video',
        'div[data-testid="watch-feed"] video', 
        '[aria-label*="Video player"] video',
        'video[data-video-id]',
        
        // Reels selektory  
        'div[data-pagelet="ReelsFeed"] video',
        'div[data-testid="reels-feed"] video',
        '[data-testid="reel-video"]',
        
        // Obecné FB video selektory
        'div[role="article"] video',
        'div[data-ft] video',
        'video'
      ];

      // Nejdřív zkus najít video bez scrollování
      for (const selector of videoSelectors) {
        const video = await fbBot.page.$(selector);
        if (video) {
          // Scroll k videu aby bylo viditelné
          await fbBot.page.evaluate((el) => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, video);
          await Wait.toSeconds(1, 'Scroll k videu');
          
          Log.debug(`[${user.id}]`, `Video nalezeno: ${selector}`);
          return true;
        }
      }

      // Pokud nenalezeno, scroll dolů a zkus znovu
      // Reels mají jiné scrollování než Watch
      const currentUrl = await fbBot.page.url();
      const isReels = currentUrl.includes('/reel/');
      
      if (isReels) {
        // Reels - vertikální scroll (menší kroky)
        await fbBot.page.evaluate(() => {
          window.scrollBy(0, 200 + Math.random() * 300); // 200-500px
        });
      } else {
        // Watch - normální scroll
        await fbBot.page.evaluate(() => {
          window.scrollBy(0, 400 + Math.random() * 400); // 400-800px
        });
      }
      await Wait.toSeconds(2, 'Načtení po scrollu');

      // Zkus znovu najít video po scrollu
      for (const selector of videoSelectors) {
        const video = await fbBot.page.$(selector);
        if (video) {
          await fbBot.page.evaluate((el) => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, video);
          await Wait.toSeconds(1, 'Scroll k videu');
          
          Log.debug(`[${user.id}]`, `Video nalezeno po scrollu: ${selector}`);
          return true;
        }
      }

      Log.debug(`[${user.id}]`, 'Žádné video nenalezeno');
      return false;

    } catch (err) {
      await Log.warn(`[${user.id}]`, `Chyba při hledání videa: ${err.message}`);
      return false;
    }
  }

  /**
   * Sleduje jedno video s realistickým chováním
   */
  async watchSingleVideo(user, fbBot, videoNumber, plan) {
    try {
      Log.debug(`[${user.id}]`, `Sledování video #${videoNumber}...`);

      // Klikni na video pro spuštění (pokud není auto-play)
      const videoStarted = await this.startVideoPlayback(user, fbBot);
      if (!videoStarted) {
        Log.debug(`[${user.id}]`, `Video #${videoNumber} se nepodařilo spustit`);
        return false;
      }

      // Simuluj sledování podle plánu
      let watchDuration = plan.avgVideoTime;
      
      // V trance módu různé délky
      if (plan.tranceMode) {
        // Někdy kratší (skip rychle), někdy delší (celé video)
        watchDuration = Math.random() < 0.3 ? 
          5 + Math.random() * 10 :  // 5-15s rychlý skip
          30 + Math.random() * 45;  // 30-75s dlouhé sledování
      }

      await Wait.toSeconds(watchDuration, `Sledování video ${videoNumber}`);

      // Občas pauza/play simulace
      if (Math.random() < 0.2) {
        await this.simulateVideoInteraction(user, fbBot);
      }

      Log.debug(`[${user.id}]`, `Video #${videoNumber} sledováno ${Math.round(watchDuration)}s`);
      return true;

    } catch (err) {
      await Log.warn(`[${user.id}]`, `Chyba při sledování video ${videoNumber}: ${err.message}`);
      return false;
    }
  }

  /**
   * Spustí přehrávání videa
   */
  async startVideoPlayback(user, fbBot) {
    try {
      // Zkus kliknout na video pro spuštění
      const clickResult = await fbBot.page.evaluate(() => {
        const videos = document.querySelectorAll('video');
        for (const video of videos) {
          if (video.offsetParent !== null) { // Je viditelné
            video.click();
            return true;
          }
        }
        return false;
      });

      if (clickResult) {
        await Wait.toSeconds(1, 'Spuštění videa');
        return true;
      }

      return false;

    } catch (err) {
      await Log.warn(`[${user.id}]`, `Chyba při spuštění videa: ${err.message}`);
      return false;
    }
  }

  /**
   * Simuluje lidské interakce s videem (pause/play, volume)
   */
  async simulateVideoInteraction(user, fbBot) {
    try {
      // Náhodná interakce
      const interactions = ['pause', 'volume', 'seek'];
      const interaction = interactions[Math.floor(Math.random() * interactions.length)];

      switch (interaction) {
        case 'pause':
          // Krátká pauza a play
          await fbBot.page.keyboard.press('Space');
          await Wait.toSeconds(2 + Math.random() * 3, 'Pause break');
          await fbBot.page.keyboard.press('Space');
          Log.debug(`[${user.id}]`, '⏸️ Pause/play interakce');
          break;

        case 'volume':
          // Volume up/down
          const volumeKey = Math.random() < 0.5 ? 'ArrowUp' : 'ArrowDown';
          await fbBot.page.keyboard.press(volumeKey);
          Log.debug(`[${user.id}]`, '🔊 Volume interakce');
          break;

        case 'seek':
          // Seek vpřed/vzad (šipky)
          const seekKey = Math.random() < 0.7 ? 'ArrowRight' : 'ArrowLeft';
          await fbBot.page.keyboard.press(seekKey);
          Log.debug(`[${user.id}]`, '⏩ Seek interakce');
          break;
      }

    } catch (err) {
      await Log.warn(`[${user.id}]`, `Chyba při video interakci: ${err.message}`);
    }
  }
}