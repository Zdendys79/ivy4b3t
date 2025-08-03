#!/usr/bin/env node

/**
 * Translation Quality Checker - kontrola a opravy překladů přes Claude API
 * Prochází přeložené citáty a vylepšuje je pro přirozenější češtinu
 */

import mysql from 'mysql2/promise';
import fetch from 'node-fetch';

class TranslationQualityChecker {
  constructor() {
    this.dbConfig = {
      host: process.env.MYSQL_HOST,
      port: process.env.MYSQL_PORT,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE + '_test',
      charset: 'utf8mb4'
    };
    
    this.claudeApiKey = process.env.ANTHROPIC_API_KEY;
    this.connection = null;
    
    // Rate limiting - 1 citát za 10 minut = 600 sekund
    this.rateLimitMs = 10 * 60 * 1000;
    
    this.stats = {
      checked: 0,
      approved: 0,
      improved: 0,
      problematic: 0,
      errors: 0,
      totalTokens: 0
    };
  }

  async connect() {
    if (!this.connection) {
      this.connection = await mysql.createConnection(this.dbConfig);
    }
    return this.connection;
  }

  async close() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  /**
   * Získat citáty s překladem k posouzení
   */
  async getTranslatedQuotes(limit = 50) {
    const conn = await this.connect();
    
    const query = `
      SELECT id, original_text, translated_text, language_code, author
      FROM quotes 
      WHERE translated_text IS NOT NULL 
        AND translated_text != '' 
        AND language_code NOT IN ('ces', 'svk')
      ORDER BY RAND()
      LIMIT ?
    `;
    
    const [rows] = await conn.execute(query, [limit]);
    return rows;
  }

  /**
   * Volání Claude API pro posouzení překladu
   */
  async checkTranslationQuality(original, translation, author, language) {
    const prompt = `Jsi profesionální lingvista a překladatel s expertízou v českém jazyce. Posuzuješ kvalitu překladu citátu s maximální precizností.

ORIGINÁL (${language}): "${original}"
SOUČASNÝ PŘEKLAD: "${translation}"
AUTOR: ${author || 'neznámý'}

KRITÉRIA HODNOCENÍ:
1. VĚRNOST ORIGINÁLU - Zachovává překlad přesný význam, nádech a styl?
2. PŘIROZENOST ČEŠTINY - Zní překlad jako nativní čeština nebo jako strojový překlad?
3. POETIČNOST - Jsou zachovány metafory, rytmus a literární kvalita?
4. GRAMATIKA - Je překlad gramaticky správný a stylově vhodný?

ODPOVĚZ PŘESNĚ V TOMTO FORMÁTU:
- Pokud je překlad výborný: "SCHVÁLENO"
- Pokud lze zlepšit: "OPRAVA: nový lepší překlad"  
- Pokud je překlad příliš problematický: "PROBLEMATICKÝ: důvod problému"

PRAVIDLA:
- Zachovej původní smysl a emocionální náboj
- Preferuj českou idiomatiku před doslovností
- Udržuj stejnou délku a rytmus jako originál
- Buď velmi kritický - schvaluj jen dokonalé překlady`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022', // Claude Sonnet pro vyšší kvalitu
          max_tokens: 300, // Zvýšeno pro detailnější hodnocení
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.content[0].text.trim();
      
      // Počítání tokenů pro monitoring
      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;
      const totalTokens = inputTokens + outputTokens;
      
      if (content.startsWith('SCHVÁLENO')) {
        return { 
          status: 'approved',
          tokens: totalTokens
        };
      }
      
      const oprava = content.match(/^OPRAVA:\s*(.+)$/);
      if (oprava) {
        return { 
          status: 'improved',
          improvedTranslation: oprava[1].replace(/^["']|["']$/g, ''),
          tokens: totalTokens
        };
      }
      
      const problem = content.match(/^PROBLEMATICKÝ:\s*(.+)$/);
      if (problem) {
        return { 
          status: 'problematic',
          reason: problem[1],
          tokens: totalTokens
        };
      }
      
      // Fallback pro neočekávaný formát
      return { 
        status: 'improved',
        improvedTranslation: content.replace(/^["']|["']$/g, ''),
        tokens: totalTokens
      };
      
    } catch (error) {
      console.error(`❌ Claude API error: ${error.message}`);
      return { error: error.message };
    }
  }

  /**
   * Uložit výsledek kontroly do databáze
   */
  async updateQuoteStatus(quoteId, newTranslation = null, approvalStatus = 0) {
    const conn = await this.connect();
    
    if (newTranslation) {
      const query = 'UPDATE quotes SET translated_text = ?, translation_approved = ? WHERE id = ?';
      await conn.execute(query, [newTranslation, approvalStatus, quoteId]);
    } else {
      const query = 'UPDATE quotes SET translation_approved = ? WHERE id = ?';
      await conn.execute(query, [approvalStatus, quoteId]);
    }
  }

  /**
   * Hlavní běh kontroly
   */
  async run() {
    console.log('🔍 SPOUŠTÍM KONTROLU KVALITY PŘEKLADŮ');
    console.log('═══════════════════════════════════════');
    console.log('⏱️  Rate limit: 1 citát za 10 minut');
    console.log('🔄 Pro ukončení stiskni Ctrl+C');
    console.log('═══════════════════════════════════════\n');

    if (!this.claudeApiKey) {
      console.error('❌ Chyba: ANTHROPIC_API_KEY není nastaven!');
      process.exit(1);
    }

    try {
      console.log('📊 Načítám citáty k posouzení...');
      const quotes = await this.getTranslatedQuotes(100);
      console.log(`📝 Nalezeno ${quotes.length} citátů s překladem\n`);

      for (const quote of quotes) {
        const startTime = Date.now();
        
        console.log(`🔍 Kontroluji citát ID ${quote.id}`);
        console.log(`📖 Originál: "${quote.original_text}"`);
        console.log(`🇨🇿 Překlad: "${quote.translated_text}"`);
        console.log(`👤 Autor: ${quote.author || 'neznámý'} (${quote.language_code})`);
        
        const result = await this.checkTranslationQuality(
          quote.original_text,
          quote.translated_text,
          quote.author,
          quote.language_code
        );

        if (result.error) {
          console.log(`❌ Chyba API: ${result.error}\n`);
          this.stats.errors++;
          continue;
        }

        // Sledování tokenů
        this.stats.totalTokens += result.tokens || 0;
        const avgTokens = Math.round(this.stats.totalTokens / (this.stats.checked + 1));
        
        if (result.status === 'approved') {
          console.log(`✅ SCHVÁLENO - překlad je výborný`);
          await this.updateQuoteStatus(quote.id, null, 1); // translation_approved = 1
          this.stats.approved++;
          
        } else if (result.status === 'improved') {
          console.log(`✨ OPRAVA: "${result.improvedTranslation}"`);
          await this.updateQuoteStatus(quote.id, result.improvedTranslation, 0); // Zůstává neschválený pro další kontrolu
          this.stats.improved++;
          console.log(`✅ Překlad aktualizován v databázi`);
          
        } else if (result.status === 'problematic') {
          console.log(`⚠️  PROBLEMATICKÝ: ${result.reason}`);
          await this.updateQuoteStatus(quote.id, null, 2); // translation_approved = 2
          this.stats.problematic++;
          console.log(`🚨 Označen jako problematický v databázi`);
        }

        this.stats.checked++;
        
        // Zobrazit průběžné statistiky s token monitoring
        const tokensInfo = result.tokens ? ` (${result.tokens} tokenů, avg: ${avgTokens})` : '';
        console.log(`📊 Statistiky: ${this.stats.checked} zkontrolováno, ${this.stats.approved} schváleno, ${this.stats.improved} opraveno, ${this.stats.problematic} problémových${tokensInfo}`);
        
        // Rate limiting - čekat 10 minut minus už strávený čas
        const elapsed = Date.now() - startTime;
        const waitTime = this.rateLimitMs - elapsed;
        
        if (waitTime > 0) {
          const waitMinutes = Math.ceil(waitTime / 1000 / 60);
          console.log(`⏳ Čekám ${waitMinutes} minut do dalšího citátu...\n`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          console.log(''); // Jen prázdný řádek
        }
      }

      this.showFinalStats();

    } catch (error) {
      console.error(`❌ Kritická chyba: ${error.message}`);
    } finally {
      await this.close();
    }
  }

  showFinalStats() {
    console.log('\n🎯 FINÁLNÍ STATISTIKY:');
    console.log(`   Zkontrolováno: ${this.stats.checked}`);
    console.log(`   Schváleno (translation_approved=1): ${this.stats.approved}`);
    console.log(`   Opraveno: ${this.stats.improved}`);
    console.log(`   Problematické (translation_approved=2): ${this.stats.problematic}`);
    console.log(`   Chyby: ${this.stats.errors}`);
    console.log(`   Celkem tokenů: ${this.stats.totalTokens}`);
    
    if (this.stats.checked > 0) {
      const approvalRate = Math.round((this.stats.approved / this.stats.checked) * 100);
      const avgTokens = Math.round(this.stats.totalTokens / this.stats.checked);
      console.log(`   Míra schválení: ${approvalRate}%`);
      console.log(`   Průměr tokenů/citát: ${avgTokens}`);
      
      // Odhad nákladů (Claude Sonnet ~$3 za 1M tokenů)
      const estimatedCost = (this.stats.totalTokens / 1000000) * 3;
      console.log(`   Odhadované náklady: $${estimatedCost.toFixed(4)}`);
    }
  }
}

// Spuštění
const checker = new TranslationQualityChecker();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Ukončuji kontrolu...');
  checker.showFinalStats();
  await checker.close();
  process.exit(0);
});

checker.run().catch(console.error);