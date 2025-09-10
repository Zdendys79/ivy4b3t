# 🌾 Quote Harvester - Automatický sběr a překlad citátů

Pokročilý systém pro automatický sběr citátů z různých zdrojů a jejich překlad do češtiny. Součást projektu **IVY4B3T**.

## 📋 Obsah

- [🚀 Rychlý start](#-rychlý-start)
- [⚙️ Režimy provozu](#️-režimy-provozu)
- [🌐 Zdroje citátů](#-zdroje-citátů)
- [🤖 Překladový robot](#-překladový-robot)
- [📊 Monitoring a statistiky](#-monitoring-a-statistiky)
- [🛠️ Technické detaily](#️-technické-detaily)
- [🔧 Konfigurace](#-konfigurace)

---

## 🚀 Rychlý start

### Požadavky
- **Node.js 22 LTS** (ES2022 support)
- **MariaDB** připojení přes environment variables
- **Internetové připojení** pro API služby

### Spuštění
```bash
# Přejít do harvester složky
cd /home/remotes/ivy4b3t/quote_harvester

# Doporučený režim pro dlouhodobý běh
node harvester.js --infinite-with-translation

# Ukončení: Ctrl+C
```

---

## ⚙️ Režimy provozu

### 🧘🌐 `--infinite-with-translation` **(DOPORUČENO)**
Optimální pro dlouhodobý běh. Kombinuje sběr nových citátů s postupným překladem.

**Co dělá:**
- Každých ~21 sekund nové kolo
- Stáhne 40-50 nových citátů ze ZenQuotes.io
- Přeloží 3 starší citáty do češtiny
- Automatické rate limiting a error handling

**Kapacita:**
- **~7,700 nových citátů/hod**
- **~500 překladů/hod**
- **24/7 provoz bez dozoru**

```bash
node harvester.js --infinite-with-translation
```

### 🎯 `--run` - Interaktivní výběr zdrojů
Harvesting s výběrem konkrétních zdrojů (15s timeout = automaticky bezlimitové).

**Dostupné zdroje:**
```
0) 🚀 AUTOMATICKY - pouze bezlimitové zdroje (VÝCHOZÍ)
1) 📚 Quotable.io API  
2) 🧘 ZenQuotes.io API (rate limit)
3) 🥷 API Ninjas (rate limit)
4) 🎲 DummyJSON API
5) 📖 Wikiquote scraping
6) 🧠 BrainyQuote scraping  
7) 🇨🇿 České citáty
8) 🌐 VŠECHNY ZDROJE (opatrně s rate limity!)
```

```bash
node harvester.js --run
```

### 🌐 `--translate-missing` - Pouze překlady
Přeloží citáty bez českého textu (max 10 najednou).

```bash
node harvester.js --translate-missing
```

### 🧘 `--zenquotes-infinite` - Pouze ZenQuotes
Nekonečný sběr pouze ze ZenQuotes.io s 7s pauzami.

```bash
node harvester.js --zenquotes-infinite
```

### 📊 Pomocné příkazy
```bash
# Zobrazit statistiky databáze
node harvester.js --stats-only

# Seznam všech zdrojů
node harvester.js --sources

# Test databázového připojení  
node harvester.js --test-connection

# Nápověda
node harvester.js --help
```

---

## 🌐 Zdroje citátů

### 🚀 API Zdroje (rychlé, spolehlivé)

#### 🧘 **ZenQuotes.io** - Hlavní zdroj
- **Typ:** Filosofické a motivační citáty
- **Jazyk:** Angličtina  
- **Rate limit:** 5 requests per 30s (6.5s pauzy)
- **Kapacita:** ~50 citátů/request
- **Kvalita:** ⭐⭐⭐⭐⭐

#### 📚 **Quotable.io**
- **Typ:** Slavné citáty osobností
- **Jazyk:** Angličtina
- **Rate limit:** 180 requests/min (žádné pauzy)
- **Kapacita:** ~680 citátů celkem
- **Kvalita:** ⭐⭐⭐⭐⭐

#### 🥷 **API Ninjas**
- **Typ:** Kategorizované citáty
- **Jazyk:** Angličtina
- **Rate limit:** 1000 requests/měsíc (7s pauzy)
- **Kapacita:** ~100 citátů/request
- **Kvalita:** ⭐⭐⭐⭐

#### 🎲 **DummyJSON**
- **Typ:** Testovací citáty
- **Jazyk:** Angličtina
- **Rate limit:** Žádný
- **Kapacita:** ~150 citátů celkem
- **Kvalita:** ⭐⭐⭐

### 🕷️ Web Scraping Zdroje

#### 📖 **Wikiquote**
- **Typ:** Encyklopedické citáty
- **Jazyky:** EN, CS, FR, DE, IT, ES
- **Rate limit:** Manuální (respektuje robots.txt)
- **Kapacita:** Tisíce citátů
- **Kvalita:** ⭐⭐⭐⭐⭐

#### 🧠 **BrainyQuote**
- **Typ:** Citáty slavných osobností
- **Jazyk:** Angličtina
- **Rate limit:** Anti-bot ochrana
- **Kapacita:** Tisíce citátů
- **Kvalita:** ⭐⭐⭐⭐

### 🇨🇿 Lokální Zdroje

#### **České citáty**
- **Typ:** Přísloví, moudra, překlady
- **Jazyk:** Čeština
- **Zdroj:** Statická databáze + překlady slavných citátů
- **Kapacita:** ~200 citátů
- **Kvalita:** ⭐⭐⭐⭐⭐

---

## 🤖 Překladový robot

### 🎯 Podporované překladové služby

#### 🔵 **Google Translate** (primární)
- **Rychlost:** ~2 sekundy/překlad
- **Kvalita:** ⭐⭐⭐⭐⭐
- **Rate limit:** 2s mezi dotazy
- **Podporované jazyky:** EN, FR, DE, IT, ES, LA, GRC

#### 🟡 **MyMemory** (fallback)
- **Rychlost:** ~3 sekundy/překlad  
- **Kvalita:** ⭐⭐⭐⭐
- **Rate limit:** 3s mezi dotazy
- **Podporované jazyky:** EN, FR, DE, IT, ES

### 🔍 Validace kvality překladů

**Automatické kontroly:**
- ✅ Minimální délka (5+ znaků)
- ✅ Rozdílnost od originálu
- ✅ Detekce error zpráv
- ✅ Kontrola délkového poměru (50-200%)
- ✅ Detekce nepreložených anglických slov
- ✅ Filtering společných anglických výrazů

**Fallback systém:**
1. Pokud Google Translate selže → zkusí MyMemory
2. Pokud všechny služby selžou → označí citát pro ruční překlad
3. Pokud překlad neprošel validací → označí jako neplatný

### 📊 Příklady kvalitních překladů

| Originál (EN) | Překlad (CS) | Služba |
|---------------|--------------|---------|
| "I never did anything worth doing by accident" | "Nikdy jsem neudělal nic, co by stálo za to, náhodou" | Google |
| "We need never be ashamed of our tears" | "Za své slzy se nikdy nemusíme stydět" | MyMemory |
| "Genius is one percent inspiration, ninety-nine percent perspiration" | "Génius je jedno procento inspirace, devadesát devět procent potu" | Google |

---

## 📊 Monitoring a statistiky

### 🔴 Real-time monitoring

```
📥 KOLO 15 - SBĚR CITÁTŮ - 3:45:22 PM
✅ Sběr: 47 nových citátů (celkem: +658)

🌐 KOLO 15 - PŘEKLADY - 3:45:22 PM  
✅ Přeložen citát ID 1245 (celkem: +42)
✅ Přeložen citát ID 1246 (celkem: +43)
✅ Přeložen citát ID 1247 (celkem: +44)

⏳ Čekám 2 sekundy do dalšího kola (citáty: +658, překlady: +44)...
```

### 📈 Statistiky databáze

```bash
node harvester.js --stats-only
```

**Výstup:**
```
📊 STATISTIKY DATABÁZE:
   Celkem citátů: 1,247
   Podle jazyků:
     Angličtina: 589 (47%)
     Čeština: 404 (32%)  
     Francouzština: 18 (1%)
     Němčina: 3 (0%)
   S autory: 935 (75%)
   Bez autorů: 85 (7%)
   S originálním textem: 940 (75%)
   Potřebuje překlad: 156 citátů
```

### 🎯 Výkonnostní metriky

**Současná kapacita (`--infinite-with-translation`):**
- **Cyklus:** ~21 sekund
- **Kola/hodinu:** 171
- **Nové citáty/hod:** ~7,700
- **Překlady/hod:** ~500
- **Denní kapacita:** ~185,000 citátů + 12,000 překladů

---

## 🛠️ Technické detaily

### 📁 Struktura projektu

```
quote_harvester/
├── harvester.js              # Hlavní entry point
├── package.json              # Dependencies
├── src/
│   ├── quote_harvester.class.js     # Hlavní orchestrátor
│   ├── database_manager.class.js    # MariaDB operations
│   ├── source_manager.class.js      # Správa zdrojů
│   ├── translation_robot.class.js   # Překladový systém
│   ├── duplicate_checker.class.js   # Detekce duplicit
│   ├── quality_validator.class.js   # Validace kvality
│   ├── language_detector.class.js   # Detekce jazyka
│   ├── logger.class.js              # Logování
│   └── sources/                     # Implementace zdrojů
│       ├── base_source.class.js
│       ├── zenquotes_source.class.js
│       ├── quotable_source.class.js
│       ├── apininjas_source.class.js
│       ├── dummyjson_source.class.js
│       ├── wikiquote_source.class.js
│       ├── brainyquote_source.class.js
│       └── cesky_source.class.js
└── docs/
    └── Quote_Harvester_README.md    # Tato dokumentace
```

### 🗄️ Databázová struktura

#### Tabulka `quotes`
```sql
CREATE TABLE quotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    text TEXT NULL,                    -- Český překlad (NULL pro ces/svk)
    original_text TEXT NOT NULL,      -- Původní text citátu
    language_code VARCHAR(3) NOT NULL, -- ISO 639-2/T jazyk
    author VARCHAR(100) NULL,          -- Autor citátu
    hash VARCHAR(32) NOT NULL UNIQUE,  -- MD5 hash pro duplicity
    next_seen DATETIME NULL,           -- Cooldown pro opakování
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (language_code) REFERENCES c_languages(code)
);
```

#### Tabulka `c_languages`
```sql
CREATE TABLE c_languages (
    code VARCHAR(3) PRIMARY KEY,       -- ISO 639-2/T kód
    name_cs VARCHAR(50) NOT NULL,     -- Český název
    name_en VARCHAR(50) NOT NULL,     -- Anglický název  
    name_native VARCHAR(50) NOT NULL, -- Nativní název
    is_active TINYINT(1) DEFAULT 1,   -- Aktivní pro harvesting
    sort_order INT DEFAULT 999
);
```

### 🔄 Logika sloupců

**Pro české/slovenské citáty (ces/svk):**
- `text` = `NULL` (nepotřebuje překlad)
- `original_text` = původní český/slovenský text

**Pro cizí citáty:**
- `text` = český překlad (nebo `NULL` pokud chybí)
- `original_text` = původní cizí text

### 🛡️ Rate Limiting & Error Handling

**API Rate Limits:**
- ZenQuotes.io: 6.5s mezi dotazy
- Google Translate: 2s mezi dotazy  
- MyMemory: 3s mezi dotazy
- API Ninjas: 7s mezi dotazy

**Inteligentní timing:**
- Sleduje čas posledního ZenQuotes dotazu
- Čeká pouze pokud je potřeba (< 6.5s od posledního)
- Využívá čekání během překladů k respektování rate limitů

**Error handling:**
- Všechny chyby se logují, ale neruší běh
- Fallback mezi překladovými službami
- Automatické reconnect při výpadku databáze
- Graceful handling síťových chyb

---

## 🔧 Konfigurace

### 🌍 Environment Variables

**Databáze (povinné):**
```bash
MYSQL_HOST=83.167.224.200
MYSQL_PORT=3306
MYSQL_USER=ivy_user
MYSQL_PASSWORD=secure_password
MYSQL_DATABASE=ivy           # Produkce: ivy, Vývoj: ivy_test
```

**API klíče (volitelné):**
```bash
API_NINJAS_KEY=your_api_key  # Pro zvýšené limity API Ninjas
```

### 🗃️ Databázové větve

**Automatická detekce:**
- **Main větev** → `ivy_test` databáze (vývoj)
- **Produkční větev** → `ivy` databáze (produkce)
- **Neznámá větev** → `ivy_test` (bezpečný fallback)

### ⚙️ Úprava parametrů

**Rate limity (ms):**
```javascript
// src/sources/zenquotes_source.class.js
this.rateLimit = 7000;  // ZenQuotes pauza

// src/translation_robot.class.js
this.rateLimits = {
    google: 2000,    // Google Translate
    mymemory: 3000   // MyMemory
};
```

**Počet překladů per kolo:**
```javascript
// src/quote_harvester.class.js, řádek 628
const quotesToTranslate = await this.findQuotesNeedingTranslation(3); // 3 per kolo
```

**Finální pauza mezi koly:**
```javascript
// src/quote_harvester.class.js, řádek 668
await new Promise(resolve => setTimeout(resolve, 2000)); // 2s pauza
```

---

## 🚨 Troubleshooting

### Časté problémy

**❌ "Cannot find module"**
```bash
cd /home/remotes/ivy4b3t/quote_harvester
npm install
```

**❌ "Connection refused"**
- Zkontroluj environment variables
- Ověř dostupnost databáze: `node harvester.js --test-connection`

**❌ "Rate limit exceeded"**
- ZenQuotes vrací chybu 429
- Harvester automaticky čeká, ale můžeš zvýšit pauzy

**❌ "Translation failed repeatedly"**
- Google Translate/MyMemory jsou nedostupné
- Zkus později nebo použij jiný režim

### Debug & Logování

**Verbose výstup:**
- Všechny operace se logují s časovými razítky
- Chyby obsahují plný stack trace
- Rate limiting je transparentně reportován

**Log úrovně:**
- 🔵 `INFO` - Normální operace
- 🟡 `WARN` - Varování (fallback služby)
- 🔴 `ERROR` - Chyby (ale běh pokračuje)
- ✅ `SUCCESS` - Úspěšné operace

---

## 📞 Podpora

**Pro otázky a problémy:**
- Zkontroluj tento README
- Spusť `node harvester.js --help`
- Test připojení: `node harvester.js --test-connection`
- Statistiky: `node harvester.js --stats-only`

**Doporučený postup při problémech:**
1. Restart harvesteru
2. Zkontroluj environment variables
3. Test databázového připojení
4. Spusť v bezpečném režimu: `node harvester.js --stats-only`

---

## 🎯 Best Practices

**Pro produkční běh:**
```bash
# Doporučený režim pro 24/7 provoz
nohup node harvester.js --infinite-with-translation > harvester.log 2>&1 &

# Monitoring logu v real-time
tail -f harvester.log
```

**Pro vývoj a testování:**
```bash
# Bezpečný test s malým objemem
echo "4" | node harvester.js --run    # DummyJSON pouze

# Test překladů na malém vzorku
node harvester.js --translate-missing
```

**Údržba databáze:**
```bash
# Pravidelná kontrola stavu
node harvester.js --stats-only

# Restart při akumulaci chyb
pkill -f "node harvester.js"
node harvester.js --infinite-with-translation
```

---

*📅 Poslední aktualizace: 3. srpna 2025*  
*🏗️ Projekt: IVY4B3T Quote Harvester v1.0*  
*👨‍💻 Autor: Zdendys + AI asistent Nyara*