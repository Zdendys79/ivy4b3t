# Analýza iv_worker_new.js - Kroky a odpovědnosti

## 📋 Celkový přehled

**Worker** je hlavní orchestrátor systému IVY4B3T, který řídí celý životní cyklus automatizace. Funguje jako **single-threaded event loop** s jasně definovanými kroky.

## 🔧 Inicializace a závislosti

**Modulární architektura:**
- `BrowserManager` - správa prohlížečů
- `UserSelector` - výběr uživatelů
- `HostnameProtection` - ochrana proti banům
- `IvyConfig` - globální konfigurace
- `UIBot`, `FBBot` - specializované boty
- `PageAnalyzer` - sjednocené FB analýzy

## 🎯 Hlavní tick() funkce - 7 kroků

### **KROK 1: Kontrola UI příkazů** (řádky 47-64)
```javascript
const uiCommand = await userSelector.checkForUICommand();
```
**Odpovědnost:**
- Kontrola databáze na UI příkazy z webového rozhraní
- Přerušení běžného cyklu pro prioritní UI operace

**Varianta A - UI příkaz na začátku:**
- Extrakce uživatele z UI příkazu
- Otevření prohlížeče pro daného uživatele
- Předání kompletní kontroly `UIBot.handleUICommandComplete()`
- **Konec cyklu** - worker čeká na dokončení UI operace

### **KROK 2: Kontrola hostname ochrany** (řádky 66-70)
```javascript
if (await hostnameProtection.isBlocked()) {
  await waitWithHeartbeat(5);
  return;
}
```
**Odpovědnost:**
- Kontrola, zda není hostname zablokován kvůli předchozím problémům
- Ochrana proti lavině banů
- Čekání 5 minut při aktivní blokaci

### **KROK 3: Výběr uživatele pro běžnou práci** (řádky 72-78)
```javascript
const user = await userSelector.selectUser();
```
**Odpovědnost:**
- **Main větev:** Rotační výběr (`getOldestReadyUser`)
- **Produkční větev:** Výběr podle dostupných akcí (`getUserWithAvailableActions`)
- Zobrazení statistik při nedostupnosti uživatelů

### **KROK 4: Otevření FB a rychlá kontrola** (řádky 82-91)
```javascript
const { instance: browser, context } = await browserManager.openForUser(user);
const fbReady = await quickFBCheck(user, context);
```
**Odpovědnost:**
- Otevření Chromium prohlížeče pro daného uživatele
- Inicializace FB stránky
- **Rychlá kontrola funkcionality:**
  - Přihlášení uživatele
  - Detekce blokace účtu
  - Kontrola základních chyb
- Ukončení při nefunkčním FB

### **KROK 5: Předání kolu štěstí** (řádky 93-94)
```javascript
await runWheelOfFortune(user, browser, context);
```
**Odpovědnost:**
- **Delegace hlavní práce** na kolo štěstí
- Výběr a provedení náhodné akce
- Správa invasive lock mechanismu
- Logování a zpracování výsledků

### **KROK 6: Kontrola UI po wheel** (řádky 96-106)
```javascript
const postUICommand = await userSelector.checkForUICommand();
```
**Odpovědnost:**
- Druhá kontrola UI příkazů po dokončení wheel
- **Varianta B:** UI příkaz pro stejného uživatele
  - Využití již otevřeného prohlížeče
  - Předání kontroly `UIBot`
- **Optimalizace:** Žádné zbytečné zavírání/otevírání prohlížeče

### **KROK 7: Zavření prohlížeče** (řádky 104-105)
```javascript
await browserManager.closeBrowser(browser);
```
**Odpovědnost:**
- Graceful shutdown prohlížeče
- Uvolnění prostředků
- Tracking aktivních browser instances

## 🔄 Podpůrné funkce

### **quickFBCheck()** (řádky 122-144)
- Inicializace FBBot
- Otevření FB stránky
- Použití sjednocených metod z `PageAnalyzer`
- **Delegace na:** `fbBot.pageAnalyzer.quickFBCheck(user)`

### **waitWithHeartbeat()** (řádky 150-177)
- Konfigurabilní čekání (`wait_min_minutes` - `wait_max_minutes`)
- Pravidelný heartbeat každých `heartbeat_interval`ms
- Průběžné logování zbývajícího času
- **Udržení spojení** s databází během čekání

### **shutdownAllBrowsers()** (řádky 183-184)
- Graceful shutdown při ukončování systému
- Delegace na `browserManager.shutdownAll()`

## 🎭 Chování při chybách

```javascript
catch (err) {
  const userChoice = await Log.errorInteractive('[WORKER]', err);
  if (userChoice === 'quit' || userChoice === true) {
    process.exit(99);
  }
  await waitWithHeartbeat(2);
}
```
**Odpovědnost:**
- **Interaktivní debugging** - zastavení při chybách
- Možnost ukončení na žádost uživatele
- Čekání 2 minuty před dalším pokusem

## 📊 Architektury rozhodnutí

### **Prioritizace:**
1. **UI příkazy** (nejvyšší priorita)
2. **Hostname ochrana** (bezpečnost)
3. **Běžná práce** (wheel of fortune)

### **Optimalizace:**
- **Jednoduchý flow** - žádné složité if-else větvení
- **Modulární delegace** - worker pouze orchestruje
- **Minimální odpovědnost** - ~180 řádků vs. původních 980+

### **Fails fast principle:**
- Okamžité ukončení cyklu při problémech
- Žádné fallback mechanismy
- Jasné error handling

Worker je nyní **čistý orchestrátor** který deleguje veškerou specializovanou práci na dedicated moduly, dodržuje Single Responsibility Principle a je snadno testovatelný.