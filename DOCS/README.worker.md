# Analýza iv_worker.js - AKTUALIZOVANÁ DOKUMENTACE

## 📋 Celkový přehled

**Worker** je hlavní orchestrátor systému IVY4B3T, který řídí celý životní cyklus automatizace. Funguje jako **single-threaded event loop** s jasně definovanými kroky a prioritami.

## 🔧 Inicializace a závislosti

**Modulární architektura:**
- `BrowserManager` - správa prohlížečů a browser reuse optimalizace
- `UserSelector` - výběr uživatelů a UI command handling
- `UIBot` - zpracování UI příkazů z webového rozhraní
- `runWheelOfFortune` - akční systém s losováním
- `getIvyConfig` - globální konfigurace
- `Wait` - čekací mechanismy s keyboard support

## 🎯 Hlavní tick() funkce - 4 KROKY (REFAKTOROVÁNO)

### **KROK 1: RESTART KONTROLA** (nejvyšší priorita)
```javascript
if (await checkRestartNeeded()) return;
```
**Odpovědnost:**
- Kontrola `global.systemState.restart_needed`
- **Okamžité ukončení** `process.exit(1)` při restart požadavku
- Nejvyšší priorita v celém systému

### **KROK 2: UI PŘÍKAZY - PRIORITA #1** (před wheel)
```javascript
const uiHandled = await handleUICommands();
if (uiHandled) return;
```
**Odpovědnost:**
- **Duální kontrola:** `global.uiCommandCache || await UIBot.quickCheck()`
- UI příkazy mají absolutní prioritu před wheel operacemi
- **Cache + DB fallback** pro spolehlivost
- Po zpracování UI příkazu → **UKONČIT worker cyklus**

**UI Command Flow:**
1. Kontrola cache i databáze současně
2. Validace uživatele pro UI příkaz
3. Browser otevření/reuse optimalizace
4. `handleUICommandComplete()` - kompletní zpracování
5. Browser optimization - ponechat otevřený pro stejného uživatele
6. Worker cyklus končí → restart

### **KROK 3: WHEEL A AKCE** (normální provoz)
```javascript
await processUserWork();
```
**Odpovědnost:**
- **Výběr uživatele:** `selectUser()` s account lock statistikami
- **Browser management:** otevření pro vybraného uživatele
- **Wheel execution:** `runWheelOfFortune()` s UI interrupt možností
- **Výsledek zpracování:** `handleWheelResult()` s browser optimalizací

**Wheel může být přerušen:**
- UI příkazem → `wheelResult.stoppedByUI`
- Restart požadavkem → `wheelResult.stoppedByRestart`

### **KROK 4: ČEKÁNÍ** (konec cyklu)
```javascript
await Wait.forNextWorkerCycle(config.wait_max_minutes);
```
**Odpovědnost:**
- **Interruptible waiting** s podporou klávesy 'q'
- Heartbeat během čekání
- UI command detection během čekání
- **Keyboard support:** 'q' → `process.exit(0)`

## 🚨 UI COMMAND PŘERUŠENÍ - MECHANISMUS

### **BĚHEM WHEEL OPERACÍ:**
- Wheel pravidelně kontroluje `global.uiCommandCache`
- Při nalezení UI příkazu → ukončí současnou akci
- Vrátí `wheelResult.stoppedByUI = true`

### **PO WHEEL PŘERUŠENÍ:**
```javascript
handleWheelResult() při stoppedByUI:
├─ Browser optimization check:
│  ├─ IF nextUICommand.user_id === currentUser.id
│  │  └─ Ponechat browser otevřený (SingletonLock prevence)
│  └─ ELSE
│     └─ Zavřít browser
├─ Log: "Wheel přerušen UI příkazem - ukončuji cyklus"
└─ return → UKONČIT worker cyklus
```

### **NOVÝ WORKER CYKLUS:**
- Spustí se `tick()` znovu
- `handleUICommands()` na začátku převezme UI příkaz z cache/DB
- **KLÍČOVÉ:** Žádné duplikované zpracování - clean handoff

## 🗂️ UI COMMAND GLOBAL CACHE - ARCHITEKTURA

### **INICIALIZACE SYSTÉMU:**
```javascript
// ivy.js při spuštění:
global.uiCommandCache = null;

// První heartbeat (AWAIT - blokující):
await backgroundHeartbeat(); // Naplní cache pokud UI příkaz existuje
```

### **HEARTBEAT MECHANISMUS:**
```javascript
// Backgroundový interval každých X sekund:
const result = await db.heartBeat({
  user_id: global.systemState.currentUserId,
  action: global.systemState.currentAction,
  actionStartedAt: global.systemState.actionStartTime
});

// Cache UI příkaz z DB odpovědi:
global.uiCommandCache = result?.uiCommand || null;
```

### **CACHE LIFECYCLE:**
1. **Heartbeat načte** UI příkaz z DB → `global.uiCommandCache`
2. **Worker detekuje** UI příkaz v cache nebo DB
3. **Worker zpracuje** UI příkaz → `handleUICommandComplete()`
4. **Po dokončení** načte další UI příkaz → `global.uiCommandCache = await UIBot.quickCheck()`
5. **Browser optimization** používá aktualizovanou cache pro rozhodování

### **VÝHODY CACHE SYSTÉMU:**
- ✅ **Okamžitá reakce** - bez čekání na DB dotazy
- ✅ **Efektivní přerušení** - wheel může rychle detekovat UI příkaz
- ✅ **DB fallback** - `global.uiCommandCache || await UIBot.quickCheck()`
- ✅ **Spolehlivost** - první heartbeat při startu načte existující UI příkazy
- ✅ **Zero race conditions** - heartbeat běží asynchronně

### **CACHE DESIGN PRINCIPLES:**
- **Single UI command** - cache obsahuje pouze jeden aktuální příkaz
- **Auto-cleanup** - po zpracování se automaticky vymaže
- **Fail-safe** - vždy fallback na DB při cache miss
- **Asynchronní** - heartbeat neblokuje worker operace

## ⌨️ ČEKÁNÍ S KEYBOARD SUPPORT

### **WORKER ČEKÁNÍ:**
```javascript
await Wait.forNextWorkerCycle(config.wait_max_minutes);
```
**Používá Wait třídu která poskytuje:**
- Keyboard support ('q' klávesy pro okamžité ukončení)
- UI command detection během čekání
- Restart detection během čekání
- Interruptible waiting mechanismus

**Detailní dokumentace keyboard support je v Wait třídě** - worker pouze deleguje na Wait.forNextWorkerCycle()

## 🔧 BROWSER OPTIMIZATION SYSTÉM

### **PUPPETEER ARCHITEKTURA OMEZENÍ:**
**KRITICKÉ OMEZENÍ:** Puppeteer neumožňuje současné spuštění více browser instances
```javascript
// ❌ NELZE - způsobí konflikt:
const browser1 = await puppeteer.launch({userDataDir: '/Profile1'});
const browser2 = await puppeteer.launch({userDataDir: '/Profile2'}); 

// ✅ MUSÍ BÝT - sekvenční spuštění:
const browser1 = await puppeteer.launch({userDataDir: '/Profile1'});
await browser1.close(); // ← POVINNÉ před dalším profilem!
const browser2 = await puppeteer.launch({userDataDir: '/Profile2'});
```

### **BROWSER REUSE LOGIC:**
```javascript
// Ponechat browser otevřený POUZE pokud další UI příkaz je pro STEJNÝ user_id:
const nextUICommand = global.uiCommandCache || await UIBot.quickCheck();
const shouldCloseBrowser = !nextUICommand || nextUICommand.user_id !== user.id;

if (shouldCloseBrowser) {
  await browserManager.closeBrowser(browser); // Zavřít pro jiného user_id
} else {
  Log.info('[WORKER]', `Ponechávám browser - stejný uživatel ${user.id}`); // Reuse
}
```

### **SCÉNÁŘE BROWSER MANAGEMENTU:**
1. **UI #1 (user_id: 30) → UI #2 (user_id: 30):**
   - Browser zůstává otevřený → **REUSE optimalizace**
   - Nový worker cyklus používá existující browser

2. **UI #1 (user_id: 30) → UI #2 (user_id: 45):**
   - Browser se zavře pro user_id: 30
   - **Nový worker cyklus** otevře browser pro user_id: 45
   - **Oddělené operace** - žádné přímé přepínání profilů

3. **UI #1 (user_id: 30) → žádný další UI:**
   - Browser se zavře
   - Worker pokračuje wheel operacemi

### **VÝHODY BROWSER REUSE:**
- ✅ **Prevence SingletonLock konfliktů** při rychlém zavření/otevření
- ✅ **Rychlejší UI command zpracování** - bez browser restart overhead
- ✅ **Méně browser restart cyklů** pro sekvenční UI příkazy
- ✅ **Optimalizace pro stejný user_id** - browser zůstává inicializovaný
- ✅ **Respect Puppeteer limitací** - vždy pouze jeden browser instance

## 📊 ARCHITEKTÚRA ROZHODNUTÍ

### **PRIORITIZACE:**
1. **Restart** (nejvyšší - okamžité ukončení)
2. **UI příkazy** (před wheel i po wheel)
3. **Wheel akce** (normální provoz)
4. **Čekání** (s interrupt možnostmi)

### **OPTIMALIZACE PRINCIPY:**
- **Fail fast** - okamžité ukončení při problémech
- **Clean handoff** - jasné předání mezi komponentami  
- **Browser reuse** - SingletonLock prevence
- **Cache + DB fallback** - spolehlivost nad rychlostí
- **Interruptible operations** - responsive na UI příkazy

### **ERROR HANDLING:**
```javascript
catch (err) {
  await handleWorkerError(err);
}

// V handleWorkerError():
const userChoice = await Log.errorInteractive('[WORKER]', err);
if (userChoice === 'quit') {
  process.exit(99);
}
```

## 🔄 SPRÁVNÝ FLOW DIAGRAM

```
START tick()
│
├─ 1. RESTART CHECK → process.exit(1) if needed
│
├─ 2. UI COMMANDS (cache + DB)
│  └─ IF found → handleUI → END CYCLE
│
├─ 3. WHEEL + ACTIONS
│  ├─ selectUser()
│  ├─ openBrowser()
│  ├─ runWheel() → may be interrupted by UI
│  └─ handleWheelResult() → browser optimization
│
└─ 4. WAIT → keyboard support + UI detection → RESTART
```

**Worker je nyní čistý orchestrátor** s jasnou separací odpovědností, spolehlivým UI handling systémem a optimalizovaným browser managementem. Systém je navržen pro robustnost a rychlou odezvu na UI příkazy při zachování efektivity normálních operací.