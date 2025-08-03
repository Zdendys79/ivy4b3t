# Quote Harvester - Automatický systém pro sběr citátů

## Přehled

Quote Harvester je pokročilý systém pro automatické získávání, validaci a import citátů z různých internetových zdrojů. Systém podporuje více jazyků, pokročilou detekci duplicit a kvalitní filtrování obsahu.

## Architektura systému

### Hlavní komponenty

```
quote_harvester/
├── harvester.js              # CLI rozhraní
├── package.json              # Závislosti
└── src/
    ├── quote_harvester.class.js    # Hlavní řídící třída
    ├── database_manager.class.js   # Správa databáze
    ├── source_manager.class.js     # Správa zdrojů
    ├── duplicate_checker.class.js  # Kontrola duplicit
    ├── quality_validator.class.js  # Validace kvality
    ├── language_detector.class.js  # Detekce jazyka
    ├── logger.class.js            # Logování
    └── sources/                   # Implementace zdrojů
        ├── base_source.class.js
        ├── quotable_source.class.js
        ├── wikiquote_source.class.js
        ├── brainyquote_source.class.js
        └── cesky_source.class.js
```

## Podporované jazyky

Systém podporuje citáty v následujících jazycích podle ISO 639-2/T standardu:

| Kód | Jazyk | Status | Zdroje |
|-----|-------|--------|--------|
| `ces` | Čeština | Aktivní | CeskySource, překlady |
| `slk` | Slovenština | Aktivní | Wikiquote |
| `eng` | Angličtina | Aktivní | Quotable, BrainyQuote, Wikiquote |
| `fra` | Francouzština | Aktivní | Wikiquote |
| `deu` | Němčina | Aktivní | Wikiquote |
| `ita` | Italština | Aktivní | Wikiquote |
| `spa` | Španělština | Aktivní | Wikiquote |
| `rus` | Ruština | Aktivní | Wikiquote |
| `lat` | Latina | Aktivní | Statické citáty |
| `grc` | Starověká řečtina | Aktivní | Statické citáty |

## Zdroje citátů

### 1. QuotableSource (API)
- **URL:** https://api.quotable.io
- **Jazyk:** Angličtina
- **Typ:** REST API
- **Výstup:** ~500 citátů
- **Vlastnosti:** Vysoká kvalita, známí autoři, rate limit 500ms

### 2. WikiquoteSource (Web Scraping)
- **URL:** https://wikiquote.org
- **Jazyky:** 6 jazyků (en, cs, fr, de, it, es)
- **Typ:** Web scraping
- **Výstup:** ~200 citátů
- **Vlastnosti:** Vícejazyčnost, ověřené citáty, rate limit 2s

### 3. BrainyQuoteSource (Web Scraping)
- **URL:** https://www.brainyquote.com
- **Jazyk:** Angličtina
- **Typ:** Web scraping
- **Výstup:** ~200 citátů
- **Vlastnosti:** Motivační citáty, kategorie, rate limit 3s

### 4. CeskySource (Statická data)
- **Jazyk:** Čeština
- **Typ:** Statická kolekce
- **Výstup:** ~50 citátů
- **Vlastnosti:** České přísloví, překlady slavných citátů, lokalizace

## Detekce duplicit

Systém používá **tříúrovňovou kontrolu duplicit**:

### 1. Přesná shoda (MD5 hash)
```javascript
const hash = crypto.createHash('md5').update(originalText || text).digest('hex');
```

### 2. Podobnost textu (Levenshtein distance)
- **Práh:** 85% podobnost = duplicita
- **Normalizace:** odstranění diakritiky, interpunkce, převod na malá písmena
- **Křížová kontrola:** český text vs. originální text z databáze

### 3. Kolekční duplicity
- Odstranění duplicit v rámci jednoho harvestingu
- Před importem do databáze

## Validace kvality

### Kritéria kvality

| Kritérium | Požadavek | Body |
|-----------|-----------|------|
| **Délka** | 10-500 znaků, 3-100 slov | 0-100 |
| **Obsah** | Bez HTML, URL, emailů | 0-90 |
| **Jazyk** | Validní kódování, rozumný poměř číslic | 0-95 |
| **Formát** | Smysluplný text, ne jen interpunkce | 0-95 |
| **Zakázané** | Bez sprostých slov, reklam | 0/100 |
| **Relevance** | Relevantní pro citáty, s/bez autora | 0-100 |

### Filtrované elementy
- **Spam:** reklamy, předplatné, odkazy
- **Technické:** HTML tagy, URL, telefony
- **Kvalita:** příliš krátké/dlouhé, pouze interpunkce
- **Obsah:** sprostá slova, nevhodný obsah

## Detekce jazyka

### Metody detekce (v pořadí priority)

1. **Franc knihovna** - automatická detekce pomocí AI
2. **Heuristika** - charakteristické znaky (ěščř, äöü, àâé, etc.)
3. **Klíčová slova** - často používané slova v každém jazyce
4. **Speciální případy** - latina (um, us, is koncovky)

### Spolehlivost
- **Vysoká (80-100%):** texty 100+ znaků s charakteristickými znaky
- **Střední (50-80%):** texty 50+ znaků nebo klíčová slova
- **Nízká (10-50%):** krátké texty, fallback na angličtinu

## Databázová struktura

### Rozšířená tabulka `quotes`
```sql
quotes:
├── id (primary key)
├── text (český překlad/originál)
├── original_text (originální text nebo NULL)
├── language_code (kód jazyka, FK na c_languages)
├── author (autor nebo NULL)
├── hash (MD5 pro detekci duplicit)
└── next_seen (časování pro použití)
```

### Číselník jazyků `c_languages`
```sql
c_languages:
├── code (ISO 639-2/T kód)
├── name_cs (název v češtině)
├── name_en (název v angličtině)
├── name_native (název v původním jazyce)
├── is_active (aktivní pro harvesting)
├── sort_order (pořadí)
└── created_at (timestamp)
```

## Použití

### Instalace závislostí
```bash
cd quote_harvester
npm install
```

### Základní spuštění
```bash
# Kompletní harvesting
node harvester.js --run

# Pouze statistiky
node harvester.js --stats-only

# Validace existujících citátů
node harvester.js --validate-only

# Seznam zdrojů
node harvester.js --sources

# Test připojení
node harvester.js --test-connection
```

### NPM scripty
```bash
npm run harvest     # Hlavní harvesting
npm run stats       # Statistiky
npm run validate    # Validace
```

## Konfigurace

### Systémové proměnné
Harvester používá stejné proměnné jako hlavní aplikace:
```bash
MYSQL_HOST=83.167.224.200
MYSQL_PORT=3306
MYSQL_USER=ivy_user
MYSQL_PASSWORD=****
MYSQL_DATABASE=ivy
```

### Automatická detekce databáze
- **Main větev:** `${MYSQL_DATABASE}_test` (ivy_test)
- **Produkční větev:** `${MYSQL_DATABASE}` (ivy)

### Rate limiting
- **QuotableSource:** 500ms mezi requesty
- **WikiquoteSource:** 2000ms (respekt k robots.txt)
- **BrainyQuoteSource:** 3000ms (opatrný přístup)

## Výstup a statistiky

### Příklad výstupu
```
🌾 Spouštím Quote Harvester
📚 Aktivní jazyky: ces, eng, fra, deu, ita, spa, rus, lat, grc
🔗 Dostupné zdroje: 4

📥 Zpracovávám zdroj: Quotable.io
📝 Načteno 500 citátů z Quotable.io
✅ Importován citát: Imagination is more important than knowledge...

🎯 VÝSLEDKY HARVESTINGU:
   Zpracováno: 950
   Importováno: 623
   Duplicity: 247
   Nevalidní: 65
   Chyby: 15
   Úspěšnost: 66%

🎉 Úspěšně importováno 623 nových citátů!
```

### Statistiky databáze
```bash
📊 STATISTIKY DATABÁZE:
   Celkem citátů: 1026
   Podle jazyků:
     Čeština: 403
     Angličtina: 445
     Francouzština: 67
     Němčina: 45
     Latina: 23
   S autory: 756
   Bez autorů: 270
   S originálním textem: 312
```

## Rozšířitelnost

### Přidání nového zdroje

1. **Vytvořit třídu** zdědící z `BaseSource`:
```javascript
export class NewSource extends BaseSource {
  constructor() {
    super('New Source', 'https://api.example.com', 'api');
    this.supportedLanguages = ['eng', 'fra'];
  }

  async fetchQuotes(activeLanguages) {
    // Implementace získávání citátů
  }
}
```

2. **Registrovat v SourceManager**:
```javascript
this.sources.push(new NewSource());
```

### Přidání nového jazyka

1. **Přidat do c_languages**:
```sql
INSERT INTO c_languages (code, name_cs, name_en, name_native, is_active) 
VALUES ('jpn', 'Japonština', 'Japanese', '日本語', 1);
```

2. **Rozšířit LanguageDetector**:
```javascript
// Přidat japonské znaky do heuristiky
if (/[ひらがなカタカナ漢字]/.test(lowerText)) {
  return 'jpn';
}
```

## Monitoring a údržba

### Logování
- **INFO:** Průběh harvestingu, statistiky
- **DEBUG:** Detaily o citátech, validaci
- **WARN:** Problémy, nevalidní citáty
- **ERROR:** Chyby zdrojů, síťové problémy

### Běžná údržba
- **Týdně:** Kontrola nových zdrojů
- **Měsíčně:** Validace kvality databáze
- **Kvartálně:** Optimalizace detekce duplicit

### Možné problémy
- **Rate limiting:** Změny v API limitech
- **Struktura stránek:** Změny v HTML struktuře
- **Blokování:** Anti-bot opatření na webech

## Bezpečnost

### Web scraping etika
- **Rate limiting:** Respektování robots.txt
- **User-Agent:** Identifikace jako educational use
- **Omezené množství:** Max 50 citátů z jedné stránky

### Databázová bezpečnost
- **Prepared statements:** Ochrana proti SQL injection
- **Validace vstupu:** Kontrola všech dat před importem
- **Zálohy:** Automatické zálohy před bulk importy

Tento systém zajišťuje **kvalitní a rozmanitý obsah** pro quote_post akci s minimálním manuálním zásahem a maximální automatizací.