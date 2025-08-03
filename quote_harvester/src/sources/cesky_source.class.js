/**
 * CeskySource - České citáty z různých zdrojů
 * Kombinuje web scraping a statická data
 */

import { BaseSource } from './base_source.class.js';

export class CeskySource extends BaseSource {
  constructor() {
    super('České citáty', null, 'mixed');
    this.supportedLanguages = ['ces'];
    this.rateLimit = 1000;
    this.description = 'České citáty, přísloví a moudra';
  }

  async fetchQuotes(activeLanguages) {
    const quotes = [];
    
    // Pouze čeština
    if (!activeLanguages.some(lang => lang.code === 'ces')) {
      return quotes;
    }

    try {
      // Statická kolekce kvalitních českých citátů
      const staticQuotes = this.getStaticCzechQuotes();
      quotes.push(...staticQuotes);

      // České překlady slavných citátů
      const translatedQuotes = this.getTranslatedQuotes();
      quotes.push(...translatedQuotes);

      // České přísloví
      const proverbs = this.getCzechProverbs();
      quotes.push(...proverbs);

      this.log(`Načteno ${quotes.length} českých citátů`);
      
    } catch (error) {
      this.log(`Chyba při načítání českých citátů: ${error.message}`, 'error');
    }

    return quotes;
  }

  /**
   * Statická kolekce kvalitních českých citátů
   */
  getStaticCzechQuotes() {
    const czechQuotes = [
      {
        text: 'Kdo si počká, ten se dočká.',
        author: null,
        language_code: 'ces'
      },
      {
        text: 'Lepší vrabec v hrsti než holub na střeše.',
        author: null,
        language_code: 'ces'
      },
      {
        text: 'Co tě nezabije, to tě posílí.',
        author: null,
        language_code: 'ces'
      },
      {
        text: 'Pravda a láska musí zvítězit nad lží a nenávistí.',
        author: 'Václav Havel',
        language_code: 'ces'
      },
      {
        text: 'Jsme-li svobodni, jsme odpovědní.',
        author: 'Tomáš Garrigue Masaryk',
        language_code: 'ces'
      },
      {
        text: 'Nejkrásnější věc, kterou můžeme prožít, je tajemno.',
        author: 'Albert Einstein',
        language_code: 'ces'
      },
      {
        text: 'Život není pro blby.',
        author: 'Jan Werich',
        language_code: 'ces'
      },
      {
        text: 'Humor je důkazem, že člověk v sobě ještě nezahubil dítě.',
        author: 'Jan Werich',
        language_code: 'ces'
      },
      {
        text: 'Bez práce nejsou koláče.',
        author: null,
        language_code: 'ces'
      },
      {
        text: 'Když nejde hora k Mohamedovi, jde Mohamed k hoře.',
        author: null,
        language_code: 'ces'
      }
    ];

    return czechQuotes.map(quote => this.normalizeQuote(quote));
  }

  /**
   * České překlady slavných světových citátů
   */
  getTranslatedQuotes() {
    const translatedQuotes = [
      {
        text: 'Být či nebýt, to je otázka.',
        original_text: 'To be or not to be, that is the question.',
        author: 'William Shakespeare',
        language_code: 'eng'
      },
      {
        text: 'Myslím, tedy jsem.',
        original_text: 'Je pense, donc je suis.',
        author: 'René Descartes',
        language_code: 'fra'
      },
      {
        text: 'Všechno tekoucí.',
        original_text: 'Πάντα ῥεῖ',
        author: 'Hérakleitos',
        language_code: 'grc'
      },
      {
        text: 'Představivost je důležitější než znalosti.',
        original_text: 'Imagination is more important than knowledge.',
        author: 'Albert Einstein',
        language_code: 'eng'
      },
      {
        text: 'Vím, že nic nevím.',
        original_text: 'Οἶδα οὐδὲν εἰδώς',
        author: 'Sókratés',
        language_code: 'grc'
      },
      {
        text: 'Přišel jsem, viděl jsem, zvítězil jsem.',
        original_text: 'Veni, vidi, vici.',
        author: 'Gaius Iulius Caesar',
        language_code: 'lat'
      },
      {
        text: 'Umění je dlouhé, život krátký.',
        original_text: 'Ars longa, vita brevis.',
        author: 'Hippokratés',
        language_code: 'lat'
      },
      {
        text: 'Buď změnou, kterou chceš ve světě vidět.',
        original_text: 'Be the change you wish to see in the world.',
        author: 'Mahátma Gándhí',
        language_code: 'eng'
      }
    ];

    return translatedQuotes.map(quote => this.normalizeQuote(quote));
  }

  /**
   * České přísloví a moudra
   */
  getCzechProverbs() {
    const proverbs = [
      'Co se v mládí naučíš, ve stáří jako když najdeš.',
      'Komu se nelení, tomu se zelení.',
      'Ranní ptáče dál doskáče.',
      'Jak se do lesa volá, tak se z lesa ozývá.',
      'Po bitvě je každý generál.',
      'Ráno moudřejší večera.',
      'Kdo maže, ten jede.',
      'Kdo chce psa bít, hůl si vždy najde.',
      'Co je psáno, to je dáno.',
      'Kdo se směje naposled, ten se směje nejlépe.',
      'Kdo jinému jámu kopá, sám do ní padá.',
      'Mlčení je zlato.',
      'Ticho, kdo mlčí, jako by kamenem hodil.',
      'Nehoda nechodí sama.',
      'Co oči nevidí, srdce nebolí.',
      'Láska prochází žaludkem.',
      'Všeho moc škodí.',
      'Dobrá rada nad zlato.',
      'Čas léčí všechny rány.',
      'Kdo hledá, najde.'
    ];

    return proverbs.map(text => this.normalizeQuote({
      text,
      author: null,
      language_code: 'ces'
    }));
  }
}