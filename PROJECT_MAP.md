# PROJECT_MAP.md - Mapa struktury IVY4B3T projektu

## 🚀 DEPLOYMENT NA VM

### DŮLEŽITÉ: Struktura projektu na vzdálených VM
- **Projekt běží POUZE ze složky `~/ivy/`** - jiné složky nejsou dostupné ani potřebné!
- **Node.js spouští aplikaci přímo z `~/ivy/`** - není potřeba hlavní repozitář
- **Instalace:** `scripts/setup-ivy.sh` - kompletní instalace včetně mazání a obnovy
- **Update:** `ivy/start.sh` nebo `ivy/main-start.sh` - automaticky aktualizují při spuštění
- **Git složka `~/git/ivy4b3t/`** - pouze pro stažení aktualizací, ne pro běh aplikace

### Spouštěcí skripty
- `start.sh` - spouští branch "production"
- `main-start.sh` - spouští branch "main"
- `update-files.sh` - pouze aktualizuje soubory bez spuštění robota

### Scripts synchronizace na VM
- **Scripts složka se synchronizuje přes Syncthing** - ne přes Git
- **Pre-commit hook automaticky synchronizuje** `scripts/` → `~/Sync/scripts/`
- **Nové skripty musí být i v Sync složce** pro dostupnost na VM

## 📰 RSS SYSTÉM - SEPARACE SERVEROVÝCH A ROBOTICKÝCH PROCESŮ

### RSS Server (~/rss-server/)
- **Běží POUZE na serveru** - ne na VM s roboty
- **Spouští se Ubuntu plánovačem (cron)** - nezávisle na robotech
- **Funkce:** Načítá RSS kanály → parsuje články → ukládá URL do databáze
- **Struktura:** `rss-standalone.js`, `rss_reader.js`, `libs/`, `sql/queries/rss.js`
- **Databáze:** Zapisuje do tabulek `rss_urls` a `rss_channels`

### News Post Akce (v robotech)
- **Běží v robotech na VM** - používá data z databáze
- **Funkce:** Bere URL z databáze → postuje na Facebook → označí jako použité
- **SQL modul:** `sql/queries/news.js` s `getAvailableNewsUrl()` a `markNewsUrlAsUsed()`
- **Databáze:** Čte z `rss_urls`, aktualizuje `used_count`

### DŮLEŽITÉ: Oddělené procesy
1. **RSS server** načítá a ukládá → **Databáze** (tabulky rss_*)
2. **Roboti** čtou z databáze → **Facebook** (postování)
3. **Žádná přímá komunikace** mezi RSS serverem a roboty!
- **Test skript**: `test-db-connection.sh` - diagnostika DB připojení

## 🎯 HLAVNÍ ENTRY POINTY

### `ivy.js` - MAIN CONTROLLER
- Hlavní řídící smyčka systému
- Heartbeat monitoring
- Inicializace globálního stavu
- Graceful shutdown

### `iv_worker.js` - CORE WORKER
- Hlavní pracovní logika
- Kontrola UI příkazů → výběr uživatele → akce
- Orchestrace mezi moduly

#### WORKER CYKLUS - DETAILNÍ POSTUP

**Hlavní funkce: `tick()` - přesný postup kroků:**

```
START tick()
│
├─ 1. RESTART KONTROLA (nejvyšší priorita)
│  └─ checkRestartNeeded()
│     └─ IF global.systemState.restart_needed === true
│        └─ process.exit(1) → OKAMŽITÉ UKONČENÍ
│
├─ 2. UI PŘÍKAZY - PRIORITA #1 (před wheel)
│  └─ handleUICommands()
│     ├─ Check: global.uiCommandCache || await UIBot.quickCheck()
│     └─ IF uiCommand found
│        ├─ getUserForUICommand() → user validation
│        ├─ openForUser() → browser + context
│        ├─ handleUICommandComplete() → zpracování UI příkazu
│        ├─ Browser optimization (stejný user = ponechat browser)
│        └─ return true → UKONČIT WORKER CYKLUS
│
├─ 3. WHEEL A AKCE (normální provoz)
│  └─ processUserWork()
│     ├─ selectUser() → výběr aktivního uživatele
│     ├─ IF no user → showAccountLockStats() → END
│     ├─ openForUser() → browser + context
│     ├─ runWheelOfFortune() → losování a provedení akce
│     └─ handleWheelResult() → zpracování výsledku wheel
│
└─ 4. ČEKÁNÍ (konec cyklu)
   └─ Wait.forNextWorkerCycle() → interruptible wait → RESTART
```

#### UI COMMAND PŘERUŠENÍ - MECHANISMUS

**1. BĚHEM WHEEL OPERACÍ:**
- Wheel pravidelně kontroluje `global.uiCommandCache`
- Při nalezení UI příkazu → `wheelResult.stoppedByUI = true`
- Wheel ukončí současnou akci a vrátí kontrolu worker

**2. PO WHEEL PŘERUŠENÍ:**
```
handleWheelResult() při stoppedByUI:
├─ Browser optimization check:
│  ├─ IF nextUICommand.user_id === currentUser.id
│  │  └─ Ponechat browser otevřený (SingletonLock prevence)
│  └─ ELSE
│     └─ Zavřít browser
├─ Log: "Wheel přerušen UI příkazem"
└─ return → UKONČIT worker cyklus
```

**3. NOVÝ WORKER CYKLUS:**
- Spustí se `tick()` znovu
- `handleUICommands()` na začátku převezme UI příkaz
- UI má vždy prioritu před wheel operacemi

#### UI COMMAND GLOBAL CACHE - ARCHITEKTURA

**INICIALIZACE:**
```javascript
// ivy.js při spuštění:
global.uiCommandCache = null;

// První heartbeat (AWAIT - čeká na dokončení):
await backgroundHeartbeat(); // Naplní cache pokud UI příkaz existuje
```

**HEARTBEAT MECHANISMUS:**
```javascript
// Každých X sekund na pozadí:
const result = await db.heartBeat({...systemState...});

// Cache UI příkaz z DB odpovědi:
global.uiCommandCache = result?.uiCommand || null;
```

**CACHE LIFECYCLE:**
1. **Heartbeat načte** UI příkaz z DB → `global.uiCommandCache`
2. **Worker zpracuje** UI příkaz → `handleUICommandComplete()`
3. **Cache se vymaže** po zpracování → `global.uiCommandCache = null`
4. **Další heartbeat** načte nový UI příkaz (pokud existuje)

**VÝHODY CACHE SYSTÉMU:**
- ✓ **Okamžitá reakce** - bez čekání na DB dotazy
- ✓ **Efektivní přerušení** - wheel může rychle detekovat UI příkaz
- ✓ **Optimalizace** - méně DB dotazů během běhu
- ✓ **Spolehlivost** - první heartbeat při startu načte existující UI příkazy

**DŮLEŽITÉ:**
- Cache obsahuje **pouze jeden aktuální** UI příkaz
- Po zpracování se automaticky **vymaže** (správné chování)
- **Žádné race conditions** - heartbeat běží asynchronně
- **Fallback na DB** - `global.uiCommandCache || await UIBot.quickCheck()`

### `iv_wheel.js` - ACTION SELECTOR
- Losování akcí podle vah
- Invasive lock management
- Delegace na ActionRouter

---

## 🏗️ CORE ARCHITEKTÚRA

### DŮLEŽITÉ: ES MODULES
- **Projekt používá ES modules** (`"type": "module"` v package.json)
- **Importy:** `import mysql from 'mysql2/promise'` (NE `require()`)
- **Exporty:** `export default` nebo `export { function }`
- **Všechny test scripty a nové soubory musí používat ES module syntax**

### DŮLEŽITÉ: MARIADB SYNTAX
- **Databáze je MariaDB** - NE MySQL!
- **VŽDY používat MariaDB kompatibilní syntax:**
  - `CURRENT_USER()` místo `USER()`
  - Další MariaDB specifické funkce podle potřeby
- **NIKDY nepoužívat MySQL specifickou syntax**

### DATABÁZE & SQL
- `iv_sql.js` - databázové připojení
- `sql/queries/` - organizované SQL dotazy:
  - `system.js` - systémové dotazy
  - `users.js` - správa uživatelů
  - `actions.js` - akce a limity
  - `groups.js` - FB skupiny
  - `logs.js` - logování

### KONFIGURACE
- `iv_config.js` - centrální konfigurace z DB
- `libs/iv_config.class.js` - config třída

### LOGOVÁNÍ
- `libs/iv_log.class.js` - centrální logging
- `libs/iv_system_logger.class.js` - systémové logy

---

## 🤖 BROWSER & AUTOMATION

### BROWSER MANAGEMENT
- `libs/iv_browser_manager.class.js` - Puppeteer správa
- `libs/iv_fb.class.js` - Facebook bot
- `libs/iv_page_analyzer.class.js` - analýza stránek

### UI AUTOMATION  
- `libs/iv_ui.class.js` - UI příkazy
- `iv_interactive.js` - interaktivní rozhraní
- `iv_interactive_debugger.js` - debugging

---

## ⚡ ACTIONS SYSTÉM

### ACTION ROUTING
- `libs/action_router.class.js` - směrování akcí
- `libs/base_action.class.js` - abstract akce

### FACEBOOK AKCE (`actions/`)
- `comment.action.js` - komentování
- `react.action.js` - reakce
- `group_post.action.js` - příspěvky do skupin
- `timeline_post.action.js` - timeline posty
- `quote_post.action.js` - citování
- `group_explore.action.js` - průzkum skupin

### UTIO AKCE
- `post_utio_g.action.js` - UTIO group post
- `post_utio_gv.action.js` - UTIO video post
- `post_utio_p.action.js` - UTIO personal post

### MESSENGER
- `messenger_check.action.js` - kontrola zpráv
- `messenger_reply.action.js` - odpovídání

### ACCOUNT MANAGEMENT
- `account_delay.action.js` - prodleva účtu
- `account_sleep.action.js` - uspání účtu

---

## 🛡️ BEZPEČNOST & MONITORING

### OCHRANA
- `libs/iv_invasive_lock.class.js` - zámky akcí
- `hostname_block_handler.js` - handling blokovaných hostů

### USER MANAGEMENT
- `libs/iv_user_selector.class.js` - výběr uživatelů
- `user_group_escalation.js` - eskalace problémů

---

## 🧠 INTELLIGENCE & BEHAVIOR

### DŮLEŽITÉ: Správné pochopení Behavioral Profiles
- **Robot SIMULUJE virtuální uživatele** - žádní fyzičtí uživatelé neexistují
- **Behavioral profiles DEFINUJÍ chování** - jak rychle píše, kolik dělá chyb, jakou má náladu
- **ŽÁDNÉ UČENÍ** - robot se neučí z úspěchů/neúspěchů, prostě plní profil
- **FB chyby = systémové chyby** - ne "špatná rozhodnutí uživatele"
- **Používáme POUZE `user_behavioral_profiles` tabulku** - žádná cache, žádné logy emocí

### CHOVÁNÍ
- `iv_human_behavior_advanced.js` - simulace lidského chování podle profilů
- `iv_rhythm.js` - rytmus aktivit
- `sql/queries/behavioral_profiles.js` - definice behavioral profilů

### ANALÝZA
- `iv_fb_group_analyzer.js` - analýza FB skupin
- `iv_fb_support.js` - Facebook support funkce

---

## 📅 PLÁNOVANÉ NÁVRHY A VYLEPŠENÍ

### Biorytmy podle data narození
- Každý uživatel by měl mít nastavené **datum narození**
- Výpočet **3 křivek biorytmů**:
  - **Fyzická** (23 denní cyklus)
  - **Psychická** (28 denní cyklus) 
  - **Emocionální** (33 denní cyklus)
- Biorytmy by ovlivňovaly:
  - Energii a výkonnost uživatele
  - Náladu a emocionální stav
  - Pravděpodobnost chyb při psaní
  - Ochotu k interakcím

---

## 🔧 UTILITIES

### POMOCNÉ TŘÍDY
- `libs/iv_wait.class.js` - čekací mechanismy s keyboard support
  - **Keyboard support:** 'q' klávesy pro okamžité ukončení (`process.exit(0)`)
  - **Interruptible waiting:** UI command a restart detection během čekání
  - **Worker integration:** `Wait.forNextWorkerCycle()` s kompletní interrupt logikou
  - **UI waiting:** `Wait._waitWithKeyboardSupport()` pro heartbeat čekání
- `libs/iv_math.class.js` - matematické utility
- `libs/iv_char.class.class.js` - práce s textem
- `libs/iv_querybuilder.class.js` - SQL builder

### ERROR HANDLING
- `libs/iv_ErrorReportBuilder.class.js` - error reporting
- `iv_fb-error-workflow.js` - FB error workflow

### STATISTIKY
- `libs/iv_action_stats.class.js` - statistiky akcí
- `sql/queries/system_metrics.js` - systémové metriky

---

## 🌐 WEB INTERFACE

### PHP KOMPONENTY (`/web/`)
- `users_management.php` - správa uživatelů
- `inc/db.php` - databázové připojení
- `inc/header.php` - hlavička

---

## 📋 KLÍČOVÉ WORKFLOW PATTERNS

### 1. STANDARDNÍ AKCE
```
ivy.js → iv_worker → iv_wheel → ActionRouter → konkrétní akce
```

### 2. UI PŘÍKAZY
```
Web interface → ui_commands tabulka → iv_worker → iv_ui.class
```

### 3. ERROR HANDLING
```
Chyba → iv_interactive_debugger → ErrorReportBuilder → databáze
```

### 4. BEZPEČNOST
```
HostnameProtection + InvasiveLock → kontrola před každou akcí
```

---

## 💡 RYCHLÉ ODKAZY PRO ČASTÉ ÚKOLY

**Hledáš akci?** → `actions/` složka
**Problém s DB?** → `sql/queries/` + `iv_sql.js`
**Browser issue?** → `libs/iv_browser_manager.class.js`
**UI automation?** → `libs/iv_ui.class.js`
**Chyby a debugging?** → `iv_interactive_debugger.js`
**Konfigurace?** → `iv_config.js`
**Logování?** → `libs/iv_log.class.js`
**User management?** → `libs/iv_user_selector.class.js`