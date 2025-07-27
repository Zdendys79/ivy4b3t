# PROJECT_MAP.md - Mapa struktury IVY4B3T projektu

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

### `iv_wheel.js` - ACTION SELECTOR
- Losování akcí podle vah
- Invasive lock management
- Delegace na ActionRouter

---

## 🏗️ CORE ARCHITEKTÚRA

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

### CHOVÁNÍ
- `iv_human_behavior_advanced.js` - simulace lidského chování
- `iv_rhythm.js` - rytmus aktivit
- `sql/queries/behavioral_profiles.js` - behaviorální profily

### ANALÝZA
- `iv_fb_group_analyzer.js` - analýza FB skupin
- `iv_fb_support.js` - Facebook support funkce

---

## 🔧 UTILITIES

### POMOCNÉ TŘÍDY
- `libs/iv_wait.class.js` - čekací mechanismy
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