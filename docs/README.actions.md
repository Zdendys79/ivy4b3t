# Refaktorované Actions Moduly 🎯

## 📋 Celkový přehled

**Actions systém** byl kompletně refaktorován podle principů **Single Responsibility**, **YAGNI**, **KISS** a **DRY**. Monolitická `IvActions` třída (800+ řádků) byla rozdělena na specializované třídy, každá s jedinou odpovědností.

## 🏗️ Architektura

### **BaseAction Abstract Class**
```javascript
// ~/ivy/libs/base_action.class.js
export class BaseAction {
  constructor(actionCode)
  async init()
  getRequirements() // { needsFB, needsUtio }
  async verifyReadiness(user, context)
  async execute(user, context, pickedAction) // ABSTRACT
  async logActionQuality(user, success, details)
  async logAction(user, groupId, description)
}
```

### **ActionRouter (Delegator)**
```javascript
// ~/ivy/libs/action_router.class.js
export class ActionRouter {
  registerAction(actionCode, ActionClass)
  getActionRequirements(actionCode)
  async verifyActionReadiness(actionCode, user, context)
  async executeAction(actionCode, user, context, pickedAction)
  getRegisteredActions()
}
```

### **IvActions (Simplified)**
```javascript
// ~/ivy/libs/iv_actions_new.class.js  
export class IvActions {
  // Pouze delegace na ActionRouter
  async runAction(user, actionCode, context, pickedAction)
  getActionRequirements(actionCode)
  async verifyActionReadiness(user, fbBot, actionCode, options)
}
```

## 🎮 Implementované Actions

### **UTIO Actions** (Invazivní - vyžadují FB + UTIO)
```javascript
// ~/ivy/actions/post_utio_g.action.js
export class PostUtioGAction extends BaseAction {
  getRequirements() { return { needsFB: true, needsUtio: true }; }
  async execute(user, context, pickedAction) {
    // 1. Získej skupinu typu G
    // 2. Otevři skupinu
    // 3. Zkus "Napište něco" nebo join
    // 4. Publikuj UTIO zprávu
  }
}
```

**Implementované:**
- `PostUtioGAction` - UTIO do běžných skupin
- `PostUtioGvAction` - UTIO do vlastních skupin
- `PostUtioPAction` - UTIO do prodejních skupin (placeholder)

### **Account Actions** (Neinvazivní - nevyžadují služby)
```javascript
// ~/ivy/actions/account_delay.action.js
export class AccountDelayAction extends BaseAction {
  getRequirements() { return { needsFB: false, needsUtio: false }; }
  async execute(user, context, pickedAction) {
    const delayMinutes = 60 + Math.random() * 180; // 1-4h
    await this.db.updateUserWorktime(user.id, delayMinutes);
    return true;
  }
}
```

**Implementované:**
- `AccountDelayAction` - Prodleva účtu 1-4 hodiny
- `AccountSleepAction` - Uspání účtu 1-3 dny

### **Content Actions** (Vyžadují pouze FB)
```javascript
// ~/ivy/actions/quote_post.action.js
export class QuotePostAction extends BaseAction {
  getRequirements() { return { needsFB: true, needsUtio: false }; }
  async execute(user, context, pickedAction) {
    // 1. Získej citát z DB
    // 2. Přejdi na FB homepage
    // 3. Napiš citát
    // 4. Publikuj
  }
}
```

**Implementované:**
- `QuotePostAction` - Publikování citátů na timeline
- `GroupExploreAction` - Průzkum skupin

### **Placeholder Actions** (Budoucí implementace)
```javascript
// ~/ivy/actions/group_post.action.js
export class GroupPostAction extends BaseAction {
  async verifyReadiness() { 
    return { ready: false, reason: 'Není implementováno' }; 
  }
  async execute() { 
    return false; 
  }
}
```

**Placeholder akce:**
- `GroupPostAction` - Příspěvky do zájmových skupin
- `TimelinePostAction` - Příspěvky na timeline
- `CommentAction` - Komentování příspěvků
- `ReactAction` - Reakce na příspěvky
- `MessengerCheckAction` - Kontrola zpráv
- `MessengerReplyAction` - Odpovědi na zprávy

## 🔄 Workflow

### **1. Registrace v ActionRouter**
```javascript
// ActionRouter.init()
this.registerAction('post_utio_g', PostUtioGAction);
this.registerAction('account_delay', AccountDelayAction);
this.registerAction('quote_post', QuotePostAction);
// ...
```

### **2. Wheel volá IvActions**
```javascript
// iv_wheel.js
const actions = new IvActions();
await actions.init();
const success = await actions.runAction(user, 'post_utio_g', context, pickedAction);
```

### **3. IvActions deleguje na ActionRouter**
```javascript
// iv_actions_new.class.js
async runAction(user, actionCode, context, pickedAction) {
  return await this.actionRouter.executeAction(actionCode, user, context, pickedAction);
}
```

### **4. ActionRouter vytvoří a spustí instanci**
```javascript
// action_router.class.js
const ActionClass = this.actionMap.get(actionCode);
const actionInstance = new ActionClass();
await actionInstance.init();
return await actionInstance.execute(user, context, pickedAction);
```

## 🚀 Výhody refaktoringu

### **Před refaktoringem:**
- 800+ řádků monolitické IvActions třídy
- Složitý switch statement pro routing
- Smíchané odpovědnosti
- Duplicitní kód pro verifikaci a logování
- Složité fallback mechanismy

### **Po refaktoringu:**
- **BaseAction:** 100 řádků - společné rozhraní
- **ActionRouter:** 180 řádků - delegace a routing
- **IvActions:** 80 řádků - pouze delegace
- **Action třídy:** 50-150 řádků každá - specializované

### **Klíčové zlepšení:**
1. **Single Responsibility** - každá třída má jednu odpovědnost
2. **YAGNI** - žádné zbytečné funkce
3. **KISS** - jednoduchá implementace
4. **DRY** - společná funkcionalita v BaseAction
5. **Testovatelnost** - každá akce je testovatelná samostatně
6. **Rozšiřitelnost** - nové akce pouze extend BaseAction

## 📊 Srovnání velikosti

| Modul | Před | Po | Rozdíl |
|-------|------|----|----|
| **IvActions** | 834 řádků | 80 řádků | -754 řádků |
| **Action Logic** | Vše v jednom | Rozděleno do 13 tříd | Modularizováno |
| **Routing** | Switch statement | ActionRouter | Čisté rozhraní |
| **Fallbacky** | Všude | Žádné | Principiální změna |

## 🔧 Pravidla implementace

### **Žádné Fallbacky:**
- Akce buď funguje, nebo selže
- Chyby se propagují nahoru
- Žádné "pokus to jinak" mechanismy

### **Čisté rozhraní:**
- Každá akce má jasně definované požadavky
- Verifikace připravenosti před spuštěním
- Jednotné logování kvality

### **Minimální závislosti:**
- Akce používají pouze to, co potřebují
- Jasné deklarace požadavků (FB, UTIO)
- Samostatná inicializace služeb

## 🎯 Použití

### **Přidání nové akce:**
```javascript
// 1. Vytvoř novou action třídu
export class MyNewAction extends BaseAction {
  constructor() { super('my_new_action'); }
  getRequirements() { return { needsFB: true, needsUtio: false }; }
  async execute(user, context, pickedAction) {
    // Implementace
    return true;
  }
}

// 2. Registruj v ActionRouter
this.registerAction('my_new_action', MyNewAction);
```

### **Spuštění akce:**
```javascript
const actions = new IvActions();
await actions.init();
const success = await actions.runAction(user, 'my_new_action', context, pickedAction);
```

## 🏁 Výsledek

Actions systém je nyní **čistý**, **modularní** a **rozšiřitelný**. Každá akce má jasně definovanou odpovědnost a dodržuje principy clean architecture. Žádné fallbacky znamenají, že systém je předvídatelný a chyby se řeší na správných místech.

**Systém je připraven na budoucí rozšíření** - přidání nové akce vyžaduje pouze vytvoření nové třídy a její registraci v routeru.