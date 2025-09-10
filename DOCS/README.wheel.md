# Refaktorovaný Wheel of Fortune 🎰

## 📋 Celkový přehled

**Wheel of Fortune** byl kompletně refaktorován podle principů **Single Responsibility** a **YAGNI**. Nyní se soustředí **pouze na losování a orchestraci**, zatímco složitější funkce byly přesunuty do specializovaných modulů.

## 🎯 Klíčové odpovědnosti

### **✅ CO WHEEL DĚLÁ:**
1. **Losování akcí** podle vah a limitů z databáze
2. **Správa InvasiveLock** - nastavení po úspěšné invazivní akci
3. **Kontrola consecutive failures** - ukončení při 5 selháních za sebou
4. **Detekce prázdného kola** - přechod na ending akce
5. **Kontrola UI přerušení** - přednost UI příkazům
6. **Orchestrace akcí** - spouštění a sledování výsledků

### **❌ CO WHEEL NEDĚLÁ:**
- ❌ Neřeší inicializaci prohlížečů/služeb
- ❌ Nevytváří statistiky a doporučení
- ❌ Neřeší action plan updates
- ❌ Neloguje detaily jednotlivých akcí
- ❌ Neřeší user behavior patterns

## 🔄 Hlavní smyčka runWheelOfFortune()

### **Inicializace:**
- Vytvoření `InvasiveLock` instance
- Vytvoření `IvActions` instance
- Reset počítadel failures a akcí
- Inicializace action plan v databázi

### **Smyčka (while true):**

#### **1. Kontrola consecutive failures**
```javascript
if (consecutiveFailures >= config.consecutive_failures_limit) {
  await actions.runAction(user, 'account_delay', { browser, context });
  break;
}
```

#### **2. Získání dostupných akcí**
```javascript
const availableActions = await getAvailableActions(user.id, invasiveLock);
```
- Načte akce z DB s aplikovanými limity
- Filtruje invazivní akce během invasive lock
- Mapuje na wheel items s `effective_weight`

#### **3. Kontrola prázdného kola**
```javascript
if (isWheelEmpty(availableActions)) {
  const endingAction = await handleEmptyWheel(user, availableActions);
  break;
}
```
- Detekuje, zda zbývají jen ending akce
- Losuje `account_delay` nebo `account_sleep`

#### **4. Losování akce**
```javascript
const pickedAction = pickAction(availableActions);
```
- Weighted random selection z normálních akcí
- Exclude ending akcí z běžného losování

#### **5. Provedení akce**
```javascript
const success = await actions.runAction(user, pickedAction.code, { browser, context }, pickedAction);
```
- **Delegace na IvActions**
- Sledování úspěchu/neúspěchu
- Nastavení invasive lock po úspěšné invazivní akci

#### **6. Kontrola UI příkazů**
```javascript
const uiCommand = await uiBot.checkForCommand();
if (uiCommand) {
  return { stoppedByUI: true };
}
```
- Přerušení kola pro UI příkazy
- Vrácení informace o UI přerušení

#### **7. Pauza mezi akcemi**
```javascript
await wait.delay(IvMath.randInterval(config.wheel_action_delay_min, config.wheel_action_delay_max));
```

## 🔒 InvasiveLock mechanismus

### **Nová třída `InvasiveLock`:**
```javascript
const invasiveLock = new InvasiveLock();
invasiveLock.init();
invasiveLock.set(cooldownMs);
invasiveLock.isActive();
invasiveLock.getRemainingSeconds();
```

### **Logika:**
1. **Wheel vlastní instanci** InvasiveLock
2. **Po úspěšné invazivní akci** wheel nastaví lock
3. **Při losování** wheel filtruje invazivní akce
4. **Cooldown se počítá** z konfigurace

## 📊 Kompetence modulů

### **Wheel (iv_wheel.js):**
- ✅ Losování a orchestrace
- ✅ InvasiveLock správa
- ✅ Consecutive failures tracking
- ✅ UI interruption detection

### **IvActions (libs/iv_actions.class.js):**
- ✅ Provedení konkrétní akce
- ✅ Inicializace potřebných služeb
- ✅ Action plan updates po úspěchu
- ✅ Logování úspěchu/neúspěchu akce

### **ActionStats (libs/iv_action_stats.class.js):**
- ✅ Statistiky a analýza akcí
- ✅ Doporučení pro optimalizaci
- ✅ Monitoring limitů

### **InvasiveLock (libs/iv_invasive_lock.class.js):**
- ✅ Správa invasive cooldown
- ✅ Kontrola stavu locku
- ✅ Časové kalkulace

### **BrowserManager (libs/iv_browser_manager.class.js):**
- ✅ Správa prohlížečů
- ✅ Lifecycle management
- ✅ Graceful shutdown

## 🚀 Výhody refaktoringu

### **Před refaktoringem:**
- 610 řádků v iv_wheel.js
- Invasive lock jako globální proměnná
- Složité fallback mechanismy
- Inicializace služeb v wheelu
- Statistiky a doporučení smíchané s logikou

### **Po refaktoringu:**
- 262 řádků v iv_wheel.js
- InvasiveLock jako clean třída
- Žádné fallbacky - buď funguje, nebo ne
- Služby inicializuje IvActions
- Statistiky v samostatném modulu

### **Klíčové zlepšení:**
1. **Single Responsibility** - každý modul má jednu odpovědnost
2. **Testovatelnost** - čisté rozhraní a dependencies
3. **Čitelnost** - jasný flow bez vedlejších efektů
4. **Maintainability** - změny v jednom modulu neovlivní ostatní
5. **Performance** - žádné zbytečné složitosti

## 📤 Výstup pro Worker

```javascript
const wheelResult = await runWheelOfFortune(user, browser, context);
// Vrací pouze:
{
  stoppedByUI: boolean  // true pokud bylo kolo přerušeno UI příkazem
}
```

**Worker jednoduše:**
- Spustí wheel
- Reaguje na `stoppedByUI` flag
- Jinak ho nezajímá, co wheel dělal

Wheel je nyní **čistý orchestrátor** který deleguje veškerou specializovanou práci na dedicated moduly a dodržuje principy clean architecture.